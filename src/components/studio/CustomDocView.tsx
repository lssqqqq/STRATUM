import React, { useState, useRef, useCallback } from 'react';
import {
  CustomDocTemplate,
  AvatarCategory,
  AvatarItem,
  TableRowItem,
  PlayerStrategyBlock,
  LoadoutRow,
  CanvasSettings,
  CustomPageBlock,
  HistoryContext
} from '../../types/customDoc';
import {
  PhotoAsset,
  MONOCHROME_AVATAR_PLACEHOLDER,
  MONOCHROME_TOWER_PLACEHOLDER,
  MONOCHROME_MAP_PLACEHOLDER,
  isMapAssetUrl
} from '../../data/tdsPhotoAssets';
import { PhotoMapCanvas } from './PhotoMapCanvas';
import { WrapTitleInput } from './WrapTitleInput';
import { getMapByUrl } from '../../data/mapCatalog';
import { CanvasControlsBar } from './CanvasControlsBar';
import { ResizableTableFrame } from './ResizableTableFrame';
import { TABLE_MIN_PX } from '../../utils/tableWidth';
import { StudioPageTab, loadStudioActiveTab, saveStudioActiveTab, saveStudioDoc, saveStudioDocAsync } from '../../utils/studioStorage';
import { compressImageFile } from '../../utils/imageCompressor';
import { downloadCustomDocx, copyCustomDocHtmlToClipboard } from '../../utils/customDocExport';
import { saveAs } from 'file-saver';
import { useStudioDrag } from './StudioDragContext';
import {
  Plus,
  Trash2,
  X,
  Upload,
  ImageOff,
  Sparkles,
  RotateCcw,
  Copy,
  FileText,
  Layout,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check
} from 'lucide-react';
import { translations, Language } from '../../i18n/translations';

/** Textarea that grows with its content and guarantees text visibility without collapsing */
const AutoGrowTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className,
  value,
  onInput,
  onFocus,
  style,
  ...rest
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const sh = el.scrollHeight;
    if (sh > 0) {
      el.style.height = `${Math.max(sh, 24)}px`;
    } else {
      el.style.height = 'auto';
    }
  }, []);

  React.useEffect(() => {
    fit();
    const r1 = requestAnimationFrame(fit);
    const r2 = setTimeout(fit, 80);
    return () => {
      cancelAnimationFrame(r1);
      clearTimeout(r2);
    };
  }, [value, fit]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    window.addEventListener('resize', fit);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => fit());
      ro.observe(el);
    }

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fit();
          }
        }
      });
      io.observe(el);
    }

    return () => {
      window.removeEventListener('resize', fit);
      ro?.disconnect();
      io?.disconnect();
    };
  }, [fit]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value ?? ''}
      onFocus={e => {
        fit();
        onFocus?.(e);
      }}
      onInput={e => {
        fit();
        onInput?.(e);
      }}
      style={{
        minHeight: '1.5rem',
        ...style
      }}
      className={className}
      {...rest}
    />
  );
};

/** Single-line fields rendered as textareas must not accept line breaks. */
const blurOnEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.currentTarget.blur();
  }
};

interface CustomDocViewProps {
  doc: CustomDocTemplate;
  onChangeDoc: (newDoc: CustomDocTemplate, customContext?: HistoryContext) => void;
  /** Tower currently selected in the left panel (used for hero slots and placements). */
  selectedAsset: PhotoAsset | null;
  /** Map currently selected in the left panel. Maps are never inserted into hero slots. */
  selectedMap?: PhotoAsset | null;
  onGenerateDoc: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  activeContext?: HistoryContext;
  onUpdateContext?: React.Dispatch<React.SetStateAction<HistoryContext>>;
  onDeleteSelectedMapObjects?: () => boolean;
  onResetDoc?: () => void;
  lang: Language;
}

export const CustomDocView: React.FC<CustomDocViewProps> = ({
  doc,
  onChangeDoc,
  selectedAsset,
  selectedMap = null,
  onGenerateDoc,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  activeContext,
  onUpdateContext,
  onDeleteSelectedMapObjects,
  onResetDoc,
  lang
}) => {
  const t = translations[lang].studio;

  // Hero locations (loadout slots and player tower cards) only ever accept TOWER assets.
  // A selected map is ignored there, so a click falls back to uploading the user's own image.
  const heroAsset: PhotoAsset | null =
    selectedAsset && selectedAsset.category === 'towers' && !isMapAssetUrl(selectedAsset.url) ? selectedAsset : null;

  // Shared look of the tiny "remove image" buttons and the empty-image placeholder.
  const removeImgBtnClass =
    'absolute z-20 w-5 h-5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-400 hover:text-red-400 hover:border-red-500/60 flex items-center justify-center opacity-0 group-hover/rm:opacity-100 focus:opacity-100 transition-opacity shadow';
  const renderEmptyImage = (iconClass = 'w-4 h-4') => (
    <div
      className="w-full h-full rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-neutral-600 print:invisible"
      title={t.emptyImageSlot}
    >
      <ImageOff className={iconClass} />
    </div>
  );
  const tEd = translations[lang].editor;
  const tCanvas = translations[lang].canvas;
  const [activeTab, setActiveTabState] = useState<StudioPageTab>(() => loadStudioActiveTab());
  const setActiveTab = (tab: StudioPageTab) => {
    setActiveTabState(tab);
    saveStudioActiveTab(tab);
  };
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const sheetWrapperRef = useRef<HTMLDivElement>(null);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const { registerDropTarget, hoveredTargetId } = useStudioDrag();

  const docRef = useRef(doc);
  docRef.current = doc;

  // Loadout of a given player (same matching rule as the Loadouts <-> Strategies sync:
  // by player number, falling back to the row with the same position).
  const getLoadoutRowForPlayer = (playerId: string) => {
    const { players, loadoutRows } = doc.tab2;
    const pIdx = players.findIndex(p => p.id === playerId);
    if (pIdx === -1) return undefined;
    const digits = players[pIdx].playerTitle.match(/\d+/);
    const byNumber = digits
      ? loadoutRows.find(r => r.playerTitle.match(/\d+/)?.[0] === digits[0])
      : undefined;
    return byNumber ?? loadoutRows[pIdx];
  };

  // Register loadout slots and player tower deck cards as drop targets
  React.useEffect(() => {
    const unsubs: (() => void)[] = [];

    // 1. Loadout slots
    doc.tab2.loadoutRows.forEach(row => {
      row.slots.forEach(slot => {
        const targetId = `loadout:${row.id}:${slot.id}`;
        unsubs.push(
          registerDropTarget({
            type: 'loadout-slot',
            id: targetId,
            handleDrop: (asset: PhotoAsset) => {
              if (asset.category === 'towers' || (!isMapAssetUrl(asset.url) && asset.url)) {
                updateLoadoutSlotAndSync(row.id, slot.id, { image: asset.url, name: asset.name });
              }
            }
          })
        );
      });
    });

    // 2. Player tower cards
    doc.tab2.players.forEach(player => {
      player.towers.forEach((tower, tIdx) => {
        const targetId = `player-tower:${player.id}:${tIdx}`;
        unsubs.push(
          registerDropTarget({
            type: 'player-tower-slot',
            id: targetId,
            handleDrop: (asset: PhotoAsset) => {
              if (asset.category === 'towers') {
                const currentDoc = docRef.current;
                const targetPlayer = currentDoc.tab2.players.find(p => p.id === player.id);
                if (targetPlayer) {
                  const newTowers = [...targetPlayer.towers];
                  newTowers[tIdx] = {
                    ...newTowers[tIdx],
                    image: asset.url,
                    name: asset.name
                  };
                  updatePlayer(player.id, { towers: newTowers });
                }
              }
            }
          })
        );
      });
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [doc.tab2.loadoutRows, doc.tab2.players, registerDropTarget]);

  // The old "Continuous Canvas" mode was removed: documents saved with it open in "All Pages" instead.
  const normalizeCanvasSettings = (s: CanvasSettings): CanvasSettings =>
    (s.layoutMode as string) === 'continuous' ? { ...s, layoutMode: 'multi-page' } : s;

  // Canvas layout, theme, zoom, format, and margins settings
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>(() => {
    return normalizeCanvasSettings(doc.canvasSettings || {
      format: 'a4',
      orientation: 'portrait',
      margins: 'normal',
      theme: 'black',
      zoom: 1,
      layoutMode: 'multi-page',
      showGrid: false,
      showPageNumbers: true
    });
  });

  const updateCanvasSettings = (updated: Partial<CanvasSettings>) => {
    const next = { ...canvasSettings, ...updated };
    setCanvasSettings(next);
    if (updated.layoutMode && onUpdateContext) {
      onUpdateContext(prev => ({ ...prev, layoutMode: updated.layoutMode }));
    }
    onChangeDoc({ ...doc, canvasSettings: next }, { layoutMode: next.layoutMode });
  };

  // Sync if doc.canvasSettings changes externally (e.g. from JSON import)
  React.useEffect(() => {
    if (doc.canvasSettings) {
      setCanvasSettings(normalizeCanvasSettings(doc.canvasSettings));
    }
  }, [doc.canvasSettings]);

  // Export & Action handlers
  const [isExporting, setIsExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleManualSave = async () => {
    setSaveStatus('saving');
    const res = await saveStudioDocAsync(doc);
    if (res.ok) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2200);
    } else {
      setSaveStatus('idle');
    }
  };

  const handleExportDocx = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // 1. Immediately flush & save latest document state before export
      saveStudioDoc(doc);
      setSaveStatus('saved');
      // 2. Generate high-fidelity DOCX with all images and rendered maps
      await downloadCustomDocx(doc);
    } catch (e) {
      console.error('Failed to export DOCX:', e);
    } finally {
      setIsExporting(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleCopyHtml = async () => {
    const ok = await copyCustomDocHtmlToClipboard(doc);
    if (ok) {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2200);
    }
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(doc, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    saveAs(blob, `tds-strategy-${Date.now()}.json`);
  };

  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed && (parsed.tab1 || parsed.tab2)) {
          onChangeDoc(parsed);
          if (parsed.canvasSettings) {
            setCanvasSettings(parsed.canvasSettings);
          }
        }
      } catch (e) {
        console.error('Failed to import strategy JSON:', e);
      }
    };
    reader.readAsText(file);
  };

  const handleAddCustomPage = () => {
    const newPage: CustomPageBlock = {
      id: `page-${Date.now()}`,
      title: 'EXTRA SECTION',
      content: 'Describe special boss mechanics, timings, or additional tips here...',
      tableRows: [
        { id: `er-${Date.now()}-1`, label: 'Note 1', content: '' },
        { id: `er-${Date.now()}-2`, label: 'Note 2', content: '' }
      ]
    };
    onChangeDoc({
      ...doc,
      extraPages: [...(doc.extraPages || []), newPage]
    });
  };

  const deleteExtraPage = (pageId: string) => {
    onChangeDoc({
      ...doc,
      extraPages: (doc.extraPages || []).filter(p => p.id !== pageId)
    });
  };

  const updateExtraPage = (pageId: string, updated: Partial<CustomPageBlock>) => {
    onChangeDoc({
      ...doc,
      extraPages: (doc.extraPages || []).map(p => (p.id === pageId ? { ...p, ...updated } : p))
    });
  };

  const handleFitWidth = () => {
    if (!sheetWrapperRef.current) return;
    const containerW = sheetWrapperRef.current.clientWidth - 48;
    const isLandscape = canvasSettings.orientation === 'landscape';
    let sheetPx = 794;
    if (canvasSettings.format === 'letter') sheetPx = isLandscape ? 1056 : 816;
    else if (canvasSettings.format === 'a3') sheetPx = isLandscape ? 1587 : 1122;
    else if (canvasSettings.format === 'widescreen') sheetPx = 1200;
    else if (isLandscape) sheetPx = 1122;

    const targetZoom = Math.min(1.4, Math.max(0.4, Number((containerW / sheetPx).toFixed(2))));
    updateCanvasSettings({ zoom: targetZoom });
  };

  // Sheet dimension computations
  const getSheetDimensions = () => {
    const isLandscape = canvasSettings.orientation === 'landscape';
    if (canvasSettings.format === 'fluid') {
      return { width: '100%', maxWidth: '1040px', minHeight: 'auto' };
    }
    let w = '210mm';
    let minH = '297mm';
    if (canvasSettings.format === 'a4') {
      w = isLandscape ? '297mm' : '210mm';
      minH = isLandscape ? '210mm' : '297mm';
    } else if (canvasSettings.format === 'letter') {
      w = isLandscape ? '279.4mm' : '215.9mm';
      minH = isLandscape ? '215.9mm' : '279.4mm';
    } else if (canvasSettings.format === 'a3') {
      w = isLandscape ? '420mm' : '297mm';
      minH = isLandscape ? '297mm' : '420mm';
    } else if (canvasSettings.format === 'widescreen') {
      w = isLandscape ? '330mm' : '185mm';
      minH = isLandscape ? '185mm' : '330mm';
    } else if (canvasSettings.format === 'custom') {
      const cw = canvasSettings.customWidthMm || 210;
      const ch = canvasSettings.customHeightMm || 297;
      w = isLandscape ? `${ch}mm` : `${cw}mm`;
      minH = isLandscape ? `${cw}mm` : `${ch}mm`;
    }
    return { width: w, maxWidth: w, minHeight: minH };
  };

  // Margins padding computation
  const getMarginPadding = () => {
    if (canvasSettings.format === 'fluid') return '24px';
    switch (canvasSettings.margins) {
      case 'narrow': return '12.7mm';
      case 'moderate': return '19mm';
      case 'wide': return '35mm';
      case 'none': return '4mm';
      case 'custom': return `${canvasSettings.customMarginsMm || 20}mm`;
      case 'normal':
      default:
        return '25.4mm';
    }
  };

  // Sheet theme classes and inline styles
  const getThemeStyles = () => {
    switch (canvasSettings.theme) {
      case 'black':
        return { className: 'bg-black text-white border-neutral-800', style: { backgroundColor: '#000000', color: '#ffffff' } };
      case 'dark':
        return { className: 'bg-[#0f0f11] text-zinc-100 border-neutral-800', style: { backgroundColor: '#0f0f11', color: '#f4f4f5' } };
      case 'midnight':
        return { className: 'bg-[#0d0714] text-purple-100 border-purple-900/60', style: { backgroundColor: '#0d0714', color: '#f5f3ff' } };
      case 'white':
        return { className: 'bg-white text-zinc-900 border-zinc-300', style: { backgroundColor: '#ffffff', color: '#09090b' } };
      case 'paper':
        return { className: 'bg-[#f8fafc] text-slate-900 border-slate-300', style: { backgroundColor: '#f8fafc', color: '#0f172a' } };
      case 'custom':
        return { className: 'border-neutral-700', style: { backgroundColor: canvasSettings.customBgColor || '#0f0f11', color: '#ffffff' } };
      default:
        return { className: 'bg-black text-white border-neutral-800', style: { backgroundColor: '#000000', color: '#ffffff' } };
    }
  };

  // Hidden sections flags (to support deleting/restoring top-level sections)
  // Stored inside the document so deleted sections stay deleted after a refresh.
  const hiddenSections: Record<string, boolean> = doc.hiddenSections ?? {};

  const toggleSection = (sectionKey: string, hide: boolean) => {
    onChangeDoc({ ...doc, hiddenSections: { ...hiddenSections, [sectionKey]: hide } });
  };

  // ================= TAB 1 MUTATIONS =================
  const updateTab1 = (updater: Partial<CustomDocTemplate['tab1']>) => {
    onChangeDoc({
      ...doc,
      tab1: { ...doc.tab1, ...updater }
    });
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await compressImageFile(file, { maxDimension: 2000, quality: 0.85 });
      if (res) updateTab1({ bannerImage: res });
    } catch (err) {
      console.error('Failed to compress banner image:', err);
    }
    if (bannerFileRef.current) bannerFileRef.current.value = '';
  };

  // Category mutations (Creators, PLACEMENT MAP MAKER, TESTERS, or custom)
  const updateCategoryTitle = (catId: string, newTitle: string) => {
    updateTab1({
      categories: doc.tab1.categories.map(c => (c.id === catId ? { ...c, title: newTitle } : c))
    });
  };

  const deleteCategory = (catId: string) => {
    updateTab1({
      categories: doc.tab1.categories.filter(c => c.id !== catId)
    });
  };

  const addCategory = () => {
    const newCat: AvatarCategory = {
      id: `cat-${Date.now()}`,
      title: 'CATEGORY TITLE',
      members: [
        { id: `mem-${Date.now()}-1`, name: 'Name', image: selectedAsset?.url || MONOCHROME_AVATAR_PLACEHOLDER },
        { id: `mem-${Date.now()}-2`, name: 'Name', image: selectedAsset?.url || MONOCHROME_AVATAR_PLACEHOLDER }
      ]
    };
    updateTab1({
      categories: [...doc.tab1.categories, newCat]
    });
  };

  const restoreDefaultCategories = () => {
    updateTab1({
      categories: [
        {
          id: 'creators',
          title: 'CREATORS',
          members: [
            { id: `c1-${Date.now()}`, name: 'Name', image: MONOCHROME_AVATAR_PLACEHOLDER },
            { id: `c2-${Date.now()}`, name: 'Name', image: MONOCHROME_AVATAR_PLACEHOLDER },
            { id: `c3-${Date.now()}`, name: 'Name', image: MONOCHROME_AVATAR_PLACEHOLDER },
            { id: `c4-${Date.now()}`, name: 'Name', image: MONOCHROME_AVATAR_PLACEHOLDER }
          ]
        },
        {
          id: 'mapMaker',
          title: 'PLACEMENT MAP MAKER',
          members: [
            { id: `mm1-${Date.now()}`, name: 'Name', image: MONOCHROME_AVATAR_PLACEHOLDER }
          ]
        },
        {
          id: 'testers',
          title: 'TESTERS',
          members: [
            { id: `t1-${Date.now()}`, name: 'Name', image: MONOCHROME_AVATAR_PLACEHOLDER },
            { id: `t2-${Date.now()}`, name: 'Name', image: MONOCHROME_AVATAR_PLACEHOLDER },
            { id: `t3-${Date.now()}`, name: 'Name', image: MONOCHROME_AVATAR_PLACEHOLDER }
          ]
        }
      ]
    });
  };

  const addMemberToCategory = (catId: string) => {
    const newMember: AvatarItem = {
      id: `mem-${Date.now()}`,
      name: 'Name',
      image: selectedAsset?.url || MONOCHROME_AVATAR_PLACEHOLDER
    };
    updateTab1({
      categories: doc.tab1.categories.map(c =>
        c.id === catId ? { ...c, members: [...c.members, newMember] } : c
      )
    });
  };

  const removeMemberFromCategory = (catId: string, memberId: string) => {
    updateTab1({
      categories: doc.tab1.categories.map(c =>
        c.id === catId ? { ...c, members: c.members.filter(m => m.id !== memberId) } : c
      )
    });
  };

  const updateMemberName = (catId: string, memberId: string, name: string) => {
    updateTab1({
      categories: doc.tab1.categories.map(c =>
        c.id === catId
          ? {
              ...c,
              members: c.members.map(m => (m.id === memberId ? { ...m, name } : m))
            }
          : c
      )
    });
  };

  const updateMemberImage = (catId: string, memberId: string, imageUrl: string) => {
    updateTab1({
      categories: doc.tab1.categories.map(c =>
        c.id === catId
          ? {
              ...c,
              members: c.members.map(m => (m.id === memberId ? { ...m, image: imageUrl } : m))
            }
          : c
      )
    });
  };

  // Direct file upload for an avatar slot from user files
  const handleMemberFileUpload = async (catId: string, memberId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await compressImageFile(file, { maxDimension: 512, quality: 0.85 });
      if (res) updateMemberImage(catId, memberId, res);
    } catch (err) {
      console.error('Failed to compress avatar image:', err);
    }
    e.target.value = '';
  };

  // Notes List (Tab 1)
  const notesItemRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const getNotesRowsTab1 = (): TableRowItem[] => {
    const rows = doc.tab1.notesRows;
    if (!rows || rows.length === 0) {
      return [{ id: 'nr1', text: '' }];
    }
    return rows;
  };

  const updateNotesRowText = (id: string, text: string) => {
    updateTab1({
      notesRows: getNotesRowsTab1().map(r => (r.id === id ? { ...r, text, label: undefined, content: undefined } : r))
    });
  };

  const addNoteItemAfter = (index: number) => {
    const rows = getNotesRowsTab1();
    const newId = `nr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newRows = [...rows];
    newRows.splice(index + 1, 0, { id: newId, text: '' });
    updateTab1({ notesRows: newRows });
    setTimeout(() => {
      notesItemRefs.current.get(newId)?.focus();
    }, 25);
  };

  const deleteNoteItemAt = (id: string, index: number, focusPrev = false) => {
    const rows = getNotesRowsTab1();
    if (rows.length <= 1) {
      updateTab1({ notesRows: [{ id: `nr-${Date.now()}`, text: '' }] });
      return;
    }
    const prevId = index > 0 ? rows[index - 1].id : rows[1]?.id;
    const newRows = rows.filter(r => r.id !== id);
    updateTab1({ notesRows: newRows });
    if (focusPrev && prevId) {
      setTimeout(() => {
        const el = notesItemRefs.current.get(prevId);
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 25);
    }
  };

  // ================= TAB 2 MUTATIONS =================
  const updateTab2 = (updater: Partial<CustomDocTemplate['tab2']>) => {
    onChangeDoc({
      ...doc,
      tab2: { ...doc.tab2, ...updater }
    });
  };

  /**
   * Updates a single slot in loadoutRows and automatically synchronizes
   * the corresponding tower slot in the matching Player Strategy block (Player 1, 2, 3, 4).
   * Preserves manual tower deletions in Strategies until the user modifies Loadouts again.
   */
  const updateLoadoutSlotAndSync = (
    rowId: string,
    slotId: string,
    updates: { image?: string; name?: string }
  ) => {
    const currentDoc = docRef.current;
    const rowIndex = currentDoc.tab2.loadoutRows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return;

    const row = currentDoc.tab2.loadoutRows[rowIndex];
    const slotIndex = row.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) return;

    // 1. Updated loadoutRows
    const newLoadoutRows = currentDoc.tab2.loadoutRows.map((r, rIdx) => {
      if (rIdx !== rowIndex) return r;
      return {
        ...r,
        slots: r.slots.map((s, sIdx) => {
          if (sIdx !== slotIndex) return s;
          return {
            ...s,
            ...(updates.image !== undefined ? { image: updates.image } : {}),
            ...(updates.name !== undefined ? { name: updates.name } : {})
          };
        })
      };
    });

    // 2. Find corresponding player in tab2.players
    // Match by player number if present (e.g. "Player 1" -> 1 matches "PLAYER 1" -> 1)
    const rowDigits = row.playerTitle.match(/\d+/);
    let playerIndex = -1;
    if (rowDigits) {
      playerIndex = currentDoc.tab2.players.findIndex(p => {
        const pDigits = p.playerTitle.match(/\d+/);
        return pDigits && pDigits[0] === rowDigits[0];
      });
    }
    // Fallback to row index if within bounds
    if (playerIndex === -1 && rowIndex < currentDoc.tab2.players.length) {
      playerIndex = rowIndex;
    }

    let newPlayers = [...currentDoc.tab2.players];
    const playerNum = rowDigits ? rowDigits[0] : `${rowIndex + 1}`;

    if (playerIndex === -1) {
      // If the player block doesn't exist yet in Strategies (e.g. Player 3 or 4), create it and sync the slot!
      const newPlayer: PlayerStrategyBlock = {
        id: `p-${Date.now()}-${playerNum}`,
        playerTitle: `PLAYER ${playerNum}`,
        difficultyBadge: 'Difficulty: Normal',
        towers: Array.from({ length: 5 }, (_, k) => ({
          id: `pt-${playerNum}-${k + 1}-${Date.now()}`,
          name: k === slotIndex ? (updates.name !== undefined ? updates.name : row.slots[k]?.name || '') : (row.slots[k]?.name || ''),
          image: k === slotIndex ? (updates.image !== undefined ? updates.image : row.slots[k]?.image || '') : (row.slots[k]?.image || '')
        })),
        mapPhoto: '',
        tokens: [],
        zones: [],
        hideMapLabels: true,
        notes: '',
        waveRows: [
          { wave: '', instructions: '' },
          { wave: '', instructions: '' },
          { wave: '', instructions: '' }
        ]
      };
      newPlayers.push(newPlayer);
    } else {
      newPlayers = newPlayers.map((p, pIdx) => {
        if (pIdx !== playerIndex) return p;

        // Ensure player has exactly 5 tower slots without duplicates
        const currentTowers = [...p.towers];
        while (currentTowers.length < 5) {
          currentTowers.push({
            id: `pt-${p.id}-${currentTowers.length + 1}-${Date.now()}`,
            name: '',
            image: ''
          });
        }

        const updatedTowers = currentTowers.slice(0, 5).map((tw, tIdx) => {
          if (tIdx !== slotIndex) return tw;
          return {
            ...tw,
            ...(updates.image !== undefined ? { image: updates.image } : {}),
            ...(updates.name !== undefined ? { name: updates.name } : {})
          };
        });

        return {
          ...p,
          towers: updatedTowers
        };
      });
    }

    updateTab2({
      loadoutRows: newLoadoutRows,
      players: newPlayers
    });
  };

  // Top Notes List (Tab 2)
  const topNotesItemRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const getTopNotesRowsTab2 = (): TableRowItem[] => {
    const rows = doc.tab2.topNotesRows;
    if (!rows || rows.length === 0) {
      return [{ id: 'tn1', text: '' }];
    }
    return rows;
  };

  const updateTopNotesRowText = (id: string, text: string) => {
    updateTab2({
      topNotesRows: getTopNotesRowsTab2().map(r => (r.id === id ? { ...r, text, label: undefined, content: undefined } : r))
    });
  };

  const addTopNoteItemAfter = (index: number) => {
    const rows = getTopNotesRowsTab2();
    const newId = `tn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newRows = [...rows];
    newRows.splice(index + 1, 0, { id: newId, text: '' });
    updateTab2({ topNotesRows: newRows });
    setTimeout(() => {
      topNotesItemRefs.current.get(newId)?.focus();
    }, 25);
  };

  const deleteTopNoteItemAt = (id: string, index: number, focusPrev = false) => {
    const rows = getTopNotesRowsTab2();
    if (rows.length <= 1) {
      updateTab2({ topNotesRows: [{ id: `tn-${Date.now()}`, text: '' }] });
      return;
    }
    const prevId = index > 0 ? rows[index - 1].id : rows[1]?.id;
    const newRows = rows.filter(r => r.id !== id);
    updateTab2({ topNotesRows: newRows });
    if (focusPrev && prevId) {
      setTimeout(() => {
        const el = topNotesItemRefs.current.get(prevId);
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 25);
    }
  };

  // Loadout Players Count: Min 1, Max 4
  const playerCount = doc.tab2.loadoutRows.length;

  const setPlayerCount = (targetCount: number) => {
    const count = Math.min(4, Math.max(1, targetCount));
    let newLoadouts = [...doc.tab2.loadoutRows];
    let newPlayers = [...doc.tab2.players];

    while (newLoadouts.length < count) {
      const i = newLoadouts.length + 1;
      const newLRow: LoadoutRow = {
        id: `lr-${Date.now()}-${i}`,
        playerTitle: `Player ${i}`,
        slots: Array.from({ length: 5 }, (_, k) => ({
          id: `s-${i}-${k + 1}-${Date.now()}`,
          name: '',
          image: ''
        }))
      };
      newLoadouts.push(newLRow);
    }
    if (newLoadouts.length > count) {
      newLoadouts = newLoadouts.slice(0, count);
    }

    while (newPlayers.length < count) {
      const i = newPlayers.length + 1;
      const matchingLoadout = newLoadouts[i - 1];
      const newPBlock: PlayerStrategyBlock = {
        id: `p-${Date.now()}-${i}`,
        playerTitle: `PLAYER ${i}`,
        difficultyBadge: 'Difficulty: Normal',
        towers: Array.from({ length: 5 }, (_, k) => ({
          id: `pt-${i}-${k + 1}-${Date.now()}`,
          name: matchingLoadout?.slots[k]?.name || '',
          image: matchingLoadout?.slots[k]?.image || ''
        })),
        mapPhoto: '',
        tokens: [],
        zones: [],
        hideMapLabels: true,
        notes: '',
        waveRows: [
          { wave: '', instructions: '' },
          { wave: '', instructions: '' },
          { wave: '', instructions: '' }
        ]
      };
      newPlayers.push(newPBlock);
    }
    if (newPlayers.length > count) {
      newPlayers = newPlayers.slice(0, count);
    }

    updateTab2({ loadoutRows: newLoadouts, players: newPlayers });
  };

  // Direct file upload for Loadout slot
  const handleLoadoutSlotUpload = async (rowId: string, slotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await compressImageFile(file, { maxDimension: 512, quality: 0.85 });
      if (res) {
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        updateLoadoutSlotAndSync(rowId, slotId, { image: res, name: baseName });
      }
    } catch (err) {
      console.error('Failed to compress loadout slot image:', err);
    }
    e.target.value = '';
  };

  // Direct file upload for Player Tower card
  const handlePlayerTowerUpload = async (pId: string, tIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await compressImageFile(file, { maxDimension: 512, quality: 0.85 });
      if (res) {
        const player = doc.tab2.players.find(p => p.id === pId);
        if (player) {
          const newTowers = [...player.towers];
          newTowers[tIdx] = { ...newTowers[tIdx], image: res };
          updatePlayer(pId, { towers: newTowers });
        }
      }
    } catch (err) {
      console.error('Failed to compress player tower image:', err);
    }
    e.target.value = '';
  };

  // Player Strategy Blocks
  const updatePlayer = (pId: string, updater: Partial<PlayerStrategyBlock>) => {
    updateTab2({
      players: doc.tab2.players.map(p => (p.id === pId ? { ...p, ...updater } : p))
    });
  };

  const duplicatePlayer = (playerId: string) => {
    const pIndex = doc.tab2.players.findIndex(p => p.id === playerId);
    if (pIndex === -1) return;
    const source = doc.tab2.players[pIndex];
    const newId = `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newPlayer: PlayerStrategyBlock = {
      ...source,
      id: newId,
      playerTitle: `${source.playerTitle} (Copy)`,
      tokens: source.tokens.map(t => ({
        ...t,
        id: `tok-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      })),
      zones: (source.zones || []).map(z => ({
        ...z,
        id: `zone-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      })),
      towers: source.towers.map(t => ({
        ...t,
        id: `pt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      })),
      waveRows: source.waveRows.map(w => ({ ...w }))
    };

    const newPlayers = [...doc.tab2.players];
    newPlayers.splice(pIndex + 1, 0, newPlayer);

    // Sync with loadouts
    const newLoadouts = [...doc.tab2.loadoutRows];
    if (newLoadouts.length < newPlayers.length && newPlayers.length <= 4) {
      newLoadouts.push({
        id: `lr-${Date.now()}`,
        playerTitle: newPlayer.playerTitle,
        slots: newPlayer.towers.map(t => ({
          id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: t.name,
          image: t.image
        }))
      });
    }

    updateTab2({ players: newPlayers, loadoutRows: newLoadouts });
  };

  const deletePlayer = (playerId: string) => {
    const newPlayers = doc.tab2.players.filter(p => p.id !== playerId);
    const newLoadouts = doc.tab2.loadoutRows.slice(0, Math.max(1, newPlayers.length));
    updateTab2({ players: newPlayers, loadoutRows: newLoadouts });
  };

  const addNewPlayerBlock = () => {
    const num = doc.tab2.players.length + 1;
    const matchingLoadout = doc.tab2.loadoutRows[num - 1];
    const newPBlock: PlayerStrategyBlock = {
      id: `p-${Date.now()}-${num}`,
      playerTitle: `PLAYER ${num}`,
      difficultyBadge: 'Difficulty: Normal',
      towers: Array.from({ length: 5 }, (_, k) => ({
        id: `pt-${num}-${k + 1}-${Date.now()}`,
        name: matchingLoadout?.slots[k]?.name || '',
        image: matchingLoadout?.slots[k]?.image || ''
      })),
      mapPhoto: '',
      tokens: [],
      zones: [],
      notes: '',
      waveRows: [
        { wave: '', instructions: '' },
        { wave: '', instructions: '' }
      ]
    };
    const newPlayers = [...doc.tab2.players, newPBlock];
    const newLoadouts = [...doc.tab2.loadoutRows];
    if (newLoadouts.length < newPlayers.length && newPlayers.length <= 4) {
      newLoadouts.push({
        id: `lr-${Date.now()}-${num}`,
        playerTitle: `Player ${num}`,
        slots: newPBlock.towers.map(t => ({
          id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: t.name || '',
          image: t.image || ''
        }))
      });
    }
    updateTab2({ players: newPlayers, loadoutRows: newLoadouts });
  };

  const duplicateCategory = (catId: string) => {
    const cat = doc.tab1.categories.find(c => c.id === catId);
    if (!cat) return;
    const newCat: AvatarCategory = {
      ...cat,
      id: `cat-${Date.now()}`,
      title: `${cat.title} (Copy)`,
      members: cat.members.map(m => ({
        ...m,
        id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      }))
    };
    const idx = doc.tab1.categories.findIndex(c => c.id === catId);
    const next = [...doc.tab1.categories];
    next.splice(idx + 1, 0, newCat);
    updateTab1({ categories: next });
  };

  const duplicateNotesBlock = () => {
    const duplicatedRows = doc.tab1.notesRows.map(r => ({
      ...r,
      id: `nr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    }));
    updateTab1({
      notesRows: [...doc.tab1.notesRows, ...duplicatedRows]
    });
  };

  // Common Issues
  const addCommonIssue = () => {
    const newIssue = {
      id: `ci-${Date.now()}`,
      wave: '',
      reason: ''
    };
    updateTab2({ commonIssuesRows: [...doc.tab2.commonIssuesRows, newIssue] });
  };

  const updateCommonIssue = (id: string, wave: string, reason: string) => {
    updateTab2({
      commonIssuesRows: doc.tab2.commonIssuesRows.map(r => (r.id === id ? { ...r, wave, reason } : r))
    });
  };

  const removeCommonIssue = (id: string) => {
    updateTab2({ commonIssuesRows: doc.tab2.commonIssuesRows.filter(r => r.id !== id) });
  };

  const renderTab1Content = () => (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Cover Banner */}
            {!hiddenSections['banner'] && (
              <div
                onClick={() => bannerFileRef.current?.click()}
                className="relative group/banner rounded-2xl overflow-hidden border-2 border-neutral-700 bg-neutral-950 shadow-2xl cursor-pointer"
                title={t.uploadCoverTooltip}
              >
                {doc.tab1.bannerImage ? (
                  <img
                    src={doc.tab1.bannerImage}
                    alt="Header Cover"
                    className="w-full h-auto max-h-[340px] object-cover"
                  />
                ) : (
                  <div className="w-full h-40 flex flex-col items-center justify-center gap-2 text-neutral-500 font-mono text-xs print:hidden">
                    <ImageOff className="w-6 h-6" />
                    <span>{t.uploadCoverTooltip}</span>
                  </div>
                )}

                <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover/banner:opacity-100 focus-within:opacity-100 transition-opacity bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-700 text-xs">
                  {(selectedMap ?? selectedAsset) && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        const src = selectedMap ?? selectedAsset;
                        if (src) updateTab1({ bannerImage: src.url });
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-neutral-200 rounded text-black text-[11px] font-bold"
                    >
                      {t.insertFromSidebar}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      bannerFileRef.current?.click();
                    }}
                    className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 rounded text-neutral-200 text-[11px] border border-neutral-700 flex items-center gap-1.5"
                  >
                    <Upload className="w-3 h-3 text-white" />
                    <span>{t.uploadCoverBtn}</span>
                  </button>
                  {doc.tab1.bannerImage && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        updateTab1({ bannerImage: '' });
                      }}
                      className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 rounded text-neutral-200 text-[11px] border border-neutral-700 flex items-center gap-1.5"
                      title={t.removeImage}
                    >
                      <ImageOff className="w-3 h-3" />
                      <span>{t.removeImage}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      toggleSection('banner', true);
                    }}
                    className="p-1 text-neutral-400 hover:text-red-400"
                    title={t.deleteCoverTooltip}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  ref={bannerFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerUpload}
                />
              </div>
            )}

            {/* Sub-banner contacts text */}
            <div className="text-center">
              <textarea
                rows={2}
                value={doc.tab1.subBannerText}
                onChange={e => updateTab1({ subBannerText: e.target.value })}
                placeholder="write here..."
                className="w-full bg-transparent text-center text-xs md:text-sm text-neutral-400 placeholder-neutral-600 focus:outline-none focus:bg-neutral-950 rounded-xl p-2 font-mono resize-none border border-transparent hover:border-neutral-800 focus:border-neutral-700"
              />
            </div>

            {/* ================= DYNAMIC CATEGORIES ================= */}
            {/* Users drop custom files into avatars without labels */}
            <div className="space-y-8">
              {doc.tab1.categories.map(category => (
                <div
                  key={category.id}
                  className="group/sec text-center space-y-4 relative p-4 rounded-2xl hover:bg-neutral-950/60 transition-colors border border-transparent hover:border-neutral-850"
                >
                  {/* Category Title with Delete button on hover */}
                  <div className="relative inline-flex items-center justify-center gap-2">
                    <input
                      type="text"
                      value={category.title}
                      onChange={e => updateCategoryTitle(category.id, e.target.value)}
                      placeholder="CATEGORY TITLE"
                      className="bg-transparent text-2xl md:text-3xl font-black text-center text-white tracking-widest uppercase focus:outline-none focus:bg-neutral-900 rounded-xl px-4 py-1 border border-transparent hover:border-neutral-800"
                    />

                    {/* Duplicate Category Button */}
                    <button
                      type="button"
                      onClick={() => duplicateCategory(category.id)}
                      className="opacity-0 group-hover/sec:opacity-100 p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700 transition-all shadow"
                      title={t.duplicateCategory}
                    >
                      <Copy className="w-4 h-4 text-white" />
                    </button>

                    {/* Delete Category Button visible on hover */}
                    <button
                      type="button"
                      onClick={() => deleteCategory(category.id)}
                      className="opacity-0 group-hover/sec:opacity-100 p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-700 transition-all shadow"
                      title={t.deleteCategory}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Members Avatars Row */}
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {category.members.map(member => (
                      <div key={member.id} className="group group/rm relative flex flex-col items-center">
                        {/* Remove single member button */}
                        <button
                          type="button"
                          onClick={() => removeMemberFromCategory(category.id, member.id)}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-400 hover:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow"
                          title={t.deleteSlot}
                        >
                          <X className="w-3 h-3" />
                        </button>

                        {/* Remove only the image (keeps the slot and its name) */}
                        {member.image && (
                          <button
                            type="button"
                            onClick={() => updateMemberImage(category.id, member.id, '')}
                            className={`${removeImgBtnClass} -top-2 -left-2`}
                            title={t.removeImage}
                            aria-label={t.removeImage}
                          >
                            <ImageOff className="w-3 h-3" />
                          </button>
                        )}

                        {/* Photo Barrier Frame */}
                        <div
                          onClick={() => {
                            document.getElementById(`avatar-file-${category.id}-${member.id}`)?.click();
                          }}
                          className="relative w-16 h-16 md:w-18 md:h-18 rounded-2xl overflow-hidden border-2 border-neutral-700 bg-neutral-900 shadow-xl cursor-pointer hover:border-white transition-all p-1 flex items-center justify-center group/av"
                          title={t.uploadAvatarTooltip}
                        >
                          {member.image ? (
                            <img
                              src={member.image}
                              alt={member.name}
                              className="w-full h-full object-contain rounded-xl"
                            />
                          ) : (
                            renderEmptyImage('w-5 h-5')
                          )}

                          {/* Hover Upload Overlay */}
                          <div className="absolute inset-0 bg-black/75 opacity-0 group-hover/av:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-mono rounded-xl">
                            <Upload className="w-3.5 h-3.5 mb-0.5 text-white" />
                            <span>{t.fileOverlay}</span>
                          </div>
                        </div>

                        {/* Hidden Native File Input */}
                        <input
                          id={`avatar-file-${category.id}-${member.id}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handleMemberFileUpload(category.id, member.id, e)}
                        />

                        {/* Nickname with placeholder */}
                        <input
                          type="text"
                          value={member.name}
                          onChange={e => updateMemberName(category.id, member.id, e.target.value)}
                          placeholder={t.namePlaceholder}
                          className="w-20 bg-transparent text-[11px] font-mono font-bold text-center text-neutral-300 placeholder-neutral-500 focus:text-white focus:outline-none mt-1.5 truncate border-b border-transparent hover:border-neutral-700 focus:border-white"
                        />
                      </div>
                    ))}

                    {/* Add Member Button inside Category */}
                    <button
                      type="button"
                      onClick={() => addMemberToCategory(category.id)}
                      className="w-16 h-16 md:w-18 md:h-18 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-white flex flex-col items-center justify-center text-neutral-400 hover:text-white transition-colors"
                      title={t.addSlotBtn}
                    >
                      <Plus className="w-5 h-5 mb-0.5" />
                      <span className="text-[9px] font-mono">{t.addSlotBtn}</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Action Bar: Add New Category or Restore Defaults */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={addCategory}
                  className="px-4 py-2 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold border border-neutral-700 flex items-center gap-2 shadow hover:border-white transition-all"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>{t.addCategoryBtn}</span>
                </button>

                {doc.tab1.categories.length === 0 && (
                  <button
                    type="button"
                    onClick={restoreDefaultCategories}
                    className="px-4 py-2 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-mono border border-neutral-700 flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.restoreCategoriesBtn}</span>
                  </button>
                )}
              </div>
            </div>

            {/* ================= NOTES TABLE (BLACK & WHITE GRID) ================= */}
            {/* Text replaced with placeholders: title and write here... */}
            {!hiddenSections['notes'] && (
              <div className="group/sec space-y-4 pt-6 relative p-3 rounded-2xl hover:bg-neutral-950/40 transition-colors">
                <div className="text-center relative inline-flex items-center justify-center w-full">
                  <input
                    type="text"
                    value={doc.tab1.notesTitle}
                    onChange={e => updateTab1({ notesTitle: e.target.value })}
                    placeholder="title"
                    className="bg-transparent text-3xl md:text-4xl font-black text-center text-white tracking-widest uppercase focus:outline-none focus:bg-neutral-900 rounded-xl px-4 py-1 border border-transparent hover:border-neutral-800"
                  />
                  {/* Duplicate Notes section button on hover */}
                  <button
                    type="button"
                    onClick={duplicateNotesBlock}
                    className="opacity-0 group-hover/sec:opacity-100 ml-2 p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700 transition-opacity"
                    title={t.duplicateNotes}
                  >
                    <Copy className="w-4 h-4 text-white" />
                  </button>

                  {/* Delete Notes section button on hover */}
                  <button
                    type="button"
                    onClick={() => toggleSection('notes', true)}
                    className="opacity-0 group-hover/sec:opacity-100 ml-2 p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-700 transition-opacity"
                    title={t.deleteNotes}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Bullet List Notes Frame */}
                <ResizableTableFrame
                  bleed
                  width={doc.tab1.notesTableWidth}
                  onWidthChange={w => updateTab1({ notesTableWidth: w })}
                  minPx={TABLE_MIN_PX.notes}
                  label={t.tableResizeLabel}
                  hint={t.tableResizeHint}
                >
                  <div className="rounded-2xl overflow-hidden border-2 border-neutral-700 bg-neutral-950 shadow-2xl p-4 md:p-5">
                    <div className="space-y-1.5">
                      {getNotesRowsTab1().map((row, idx) => {
                        const rowText =
                          row.text !== undefined
                            ? row.text
                            : row.label && row.content
                              ? `${row.label}: ${row.content}`
                              : row.content || row.label || '';
                        return (
                          <div
                            key={row.id}
                            className="flex items-center gap-2.5 group/bullet py-1 px-2.5 rounded-xl hover:bg-neutral-900/60 transition-colors"
                          >
                            <span className="text-neutral-400 group-hover/bullet:text-white text-base font-black shrink-0 select-none pl-1">
                              •
                            </span>
                            <input
                              ref={el => {
                                if (el) notesItemRefs.current.set(row.id, el);
                                else notesItemRefs.current.delete(row.id);
                              }}
                              type="text"
                              value={rowText}
                              onChange={e => updateNotesRowText(row.id, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addNoteItemAfter(idx);
                                } else if (e.key === 'Backspace' && rowText === '') {
                                  e.preventDefault();
                                  deleteNoteItemAt(row.id, idx, true);
                                }
                              }}
                              placeholder={t.writeHerePlaceholder || 'Write note item...'}
                              className="flex-1 bg-transparent text-xs md:text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:text-white px-2 py-1 font-display border-b border-transparent hover:border-neutral-800 focus:border-neutral-500 transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => deleteNoteItemAt(row.id, idx, false)}
                              className="opacity-0 group-hover/bullet:opacity-100 p-1 rounded-md text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-all shrink-0"
                              title={t.deleteRow || 'Delete item'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </ResizableTableFrame>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => addNoteItemAfter(getNotesRowsTab1().length - 1)}
                    className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5 border border-neutral-700 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add item</span>
                  </button>
                </div>
              </div>
            )}

            {/* Restore hidden sections buttons */}
            {Object.values(hiddenSections).some(Boolean) && (
              <div className="pt-4 border-t border-neutral-800 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-neutral-500 font-mono">{t.restoreSectionsLabel}</span>
                {hiddenSections['banner'] && (
                  <button
                    type="button"
                    onClick={() => toggleSection('banner', false)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.restoreCover}</span>
                  </button>
                )}
                {hiddenSections['notes'] && (
                  <button
                    type="button"
                    onClick={() => toggleSection('notes', false)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.restoreNotes}</span>
                  </button>
                )}
              </div>
            )}
    </div>
  );

  const renderTab2Content = () => (
    <div className="space-y-10 animate-in fade-in duration-200">
            {/* 1. TOP NOTES (Grid placeholders) */}
            {!hiddenSections['topNotes'] && (
              <div className="group/sec space-y-3 relative p-3 rounded-2xl hover:bg-neutral-950/40 transition-colors">
                <div className="text-center relative inline-flex items-center justify-center w-full">
                  <input
                    type="text"
                    value={doc.tab2.topNotesTitle}
                    onChange={e => updateTab2({ topNotesTitle: e.target.value })}
                    placeholder="title"
                    className="bg-transparent text-2xl md:text-3xl font-black text-center text-white tracking-widest uppercase focus:outline-none focus:bg-neutral-900 rounded-xl px-4 py-1 border border-transparent hover:border-neutral-800"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSection('topNotes', true)}
                    className="opacity-0 group-hover/sec:opacity-100 ml-2 p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-700"
                    title={t.deleteNotes}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <ResizableTableFrame
                  bleed
                  width={doc.tab2.topNotesTableWidth}
                  onWidthChange={w => updateTab2({ topNotesTableWidth: w })}
                  minPx={TABLE_MIN_PX.notes}
                  label={t.tableResizeLabel}
                  hint={t.tableResizeHint}
                >
                  <div className="rounded-2xl overflow-hidden border-2 border-neutral-700 bg-neutral-950 shadow-2xl p-4 md:p-5">
                    <div className="space-y-1.5">
                      {getTopNotesRowsTab2().map((row, idx) => {
                        const rowText =
                          row.text !== undefined
                            ? row.text
                            : row.label && row.content
                              ? `${row.label}: ${row.content}`
                              : row.content || row.label || '';
                        return (
                          <div
                            key={row.id}
                            className="flex items-center gap-2.5 group/bullet py-1 px-2.5 rounded-xl hover:bg-neutral-900/60 transition-colors"
                          >
                            <span className="text-neutral-400 group-hover/bullet:text-white text-base font-black shrink-0 select-none pl-1">
                              •
                            </span>
                            <input
                              ref={el => {
                                if (el) topNotesItemRefs.current.set(row.id, el);
                                else topNotesItemRefs.current.delete(row.id);
                              }}
                              type="text"
                              value={rowText}
                              onChange={e => updateTopNotesRowText(row.id, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addTopNoteItemAfter(idx);
                                } else if (e.key === 'Backspace' && rowText === '') {
                                  e.preventDefault();
                                  deleteTopNoteItemAt(row.id, idx, true);
                                }
                              }}
                              placeholder={t.writeHerePlaceholder || 'Write note item...'}
                              className="flex-1 bg-transparent text-xs md:text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:text-white px-2 py-1 font-display border-b border-transparent hover:border-neutral-800 focus:border-neutral-500 transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => deleteTopNoteItemAt(row.id, idx, false)}
                              className="opacity-0 group-hover/bullet:opacity-100 p-1 rounded-md text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-all shrink-0"
                              title={t.deleteRow || 'Delete item'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </ResizableTableFrame>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => addTopNoteItemAfter(getTopNotesRowsTab2().length - 1)}
                    className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5 border border-neutral-700 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add item</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. LOADOUTS */}
            {!hiddenSections['loadouts'] && (
              <div className="group/sec space-y-4 relative p-3 rounded-2xl hover:bg-neutral-950/40 transition-colors">
                {/* Section heading: centered above the table. It lives in its own full-width row, so it stays
                    centered no matter how wide the table is or which page orientation is used. */}
                <div className="relative flex items-center justify-center w-full">
                  <input
                    type="text"
                    value={doc.tab2.loadoutsTitle}
                    onChange={e => updateTab2({ loadoutsTitle: e.target.value })}
                    placeholder={t.loadoutsTitlePlaceholder}
                    className="min-w-0 w-full bg-transparent text-2xl md:text-3xl font-black text-center text-white tracking-widest uppercase focus:outline-none focus:bg-neutral-900 rounded-xl px-10 py-1 border border-transparent hover:border-neutral-800"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSection('loadouts', true)}
                    className="opacity-0 group-hover/sec:opacity-100 absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-700 print:hidden"
                    title={t.deleteLoadouts}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Player Count Control: wraps instead of overflowing its container */}
                <div className="flex justify-center">
                  <div className="flex flex-wrap items-center justify-center gap-1.5 bg-neutral-900 p-2 rounded-2xl border border-neutral-800 text-xs font-mono max-w-full min-w-0">
                    <span className="text-neutral-400 px-1 font-bold shrink-0">{t.playersCountLabel}</span>
                    {[1, 2, 3, 4].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPlayerCount(num)}
                        className={`w-7 h-7 shrink-0 rounded-xl font-bold flex items-center justify-center transition-all ${
                          playerCount === num
                            ? 'bg-white text-black shadow-md scale-105'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Loadouts Table: its own resizable width (stored in doc.tab2.loadoutsTableWidth) */}
                <ResizableTableFrame
                  bleed
                  width={doc.tab2.loadoutsTableWidth}
                  onWidthChange={w => updateTab2({ loadoutsTableWidth: w })}
                  minPx={TABLE_MIN_PX.loadouts}
                  label={t.tableResizeLabel}
                  hint={t.tableResizeHint}
                >
                  <div className="loadout-cq rounded-2xl overflow-hidden border-2 border-neutral-700 bg-neutral-950 shadow-2xl">
                    {/* Fixed layout + percentage columns: the 6 columns always share exactly the table width, so no
                        column can be squeezed out of view. Hero images and names scale with the table (see .loadout-* in index.css). */}
                    <table className="w-full border-collapse table-fixed">
                      <colgroup>
                        <col style={{ width: '17%' }} />
                        {[0, 1, 2, 3, 4].map(i => (
                          <col key={i} style={{ width: '16.6%' }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-900 text-[11px] font-mono uppercase text-neutral-400">
                          <th className="px-2 py-2.5 md:px-3 md:py-3 text-center">{t.thPlayer}</th>
                          {['Slot 1', 'Slot 2', 'Slot 3', 'Slot 4', 'Slot 5'].map(slot => (
                            <th key={slot} className="px-1 py-2.5 md:py-3 text-center border-l border-neutral-800 whitespace-nowrap">
                              {slot}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(doc.tab2.loadoutRows && doc.tab2.loadoutRows.length > 0
                          ? doc.tab2.loadoutRows
                          : [
                              {
                                id: 'lr1',
                                playerTitle: 'Player 1',
                                slots: Array.from({ length: 5 }, (_, k) => ({
                                  id: `s1-${k + 1}`,
                                  name: '',
                                  image: ''
                                }))
                              }
                            ]
                        ).map((row, rowIndex) => {
                          const fallbackTitle = rowIndex === 0 ? 'Player 1' : `Player ${rowIndex + 1}`;
                          const displayValue =
                            row.playerTitle !== undefined && row.playerTitle !== null && row.playerTitle !== ''
                              ? row.playerTitle
                              : fallbackTitle;

                          return (
                          <tr key={row.id} className="border-b border-neutral-800 last:border-b-0">
                            {/* Player Title Column (editable, wraps instead of clipping) */}
                            <td className="px-2 py-3 md:px-3 bg-neutral-900 border-r border-neutral-800 align-middle text-center">
                              <AutoGrowTextarea
                                value={displayValue}
                                onKeyDown={blurOnEnter}
                                onChange={e => {
                                  const val = e.target.value;
                                  const currentRows =
                                    doc.tab2.loadoutRows && doc.tab2.loadoutRows.length > 0
                                      ? doc.tab2.loadoutRows
                                      : [
                                          {
                                            id: row.id,
                                            playerTitle: fallbackTitle,
                                            slots: row.slots
                                          }
                                        ];
                                  updateTab2({
                                    loadoutRows: currentRows.map(r =>
                                      r.id === row.id ? { ...r, playerTitle: val } : r
                                    )
                                  });
                                }}
                                onBlur={() => {
                                  const currentRows =
                                    doc.tab2.loadoutRows && doc.tab2.loadoutRows.length > 0
                                      ? doc.tab2.loadoutRows
                                      : [
                                          {
                                            id: row.id,
                                            playerTitle: fallbackTitle,
                                            slots: row.slots
                                          }
                                        ];
                                  if (!row.playerTitle || !row.playerTitle.trim()) {
                                    updateTab2({
                                      loadoutRows: currentRows.map(r =>
                                        r.id === row.id ? { ...r, playerTitle: fallbackTitle } : r
                                      )
                                    });
                                  }
                                }}
                                placeholder={fallbackTitle}
                                aria-label={fallbackTitle}
                                className="loadout-player-name w-full bg-transparent font-black text-xs md:text-sm text-white text-center leading-tight focus:outline-none focus:bg-neutral-850 rounded px-1 border-b border-transparent hover:border-neutral-700 focus:border-white resize-none overflow-hidden break-words font-display min-h-[1.5rem]"
                              />
                            </td>

                            {/* 5 Slots with Photo Barrier Frame & Direct File Upload */}
                            {row.slots.map(slot => (
                              <td
                                key={slot.id}
                                className="px-1.5 py-2 text-center border-l border-neutral-800 bg-neutral-950 align-middle"
                              >
                                <div className="flex flex-col items-center min-w-0">
                                  {/* Photo Barrier Frame */}
                                  <div className="relative group/rm">
                                  {slot.image && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateLoadoutSlotAndSync(row.id, slot.id, { image: '', name: '' })
                                      }
                                      className={`${removeImgBtnClass} -top-1.5 -right-1.5`}
                                      title={t.removeImage}
                                      aria-label={t.removeImage}
                                    >
                                      <ImageOff className="w-3 h-3" />
                                    </button>
                                  )}
                                  <div
                                    onClick={() => {
                                      if (heroAsset) {
                                        updateLoadoutSlotAndSync(row.id, slot.id, {
                                          image: heroAsset.url,
                                          name: heroAsset.name
                                        });
                                      } else {
                                        document.getElementById(`loadout-file-${row.id}-${slot.id}`)?.click();
                                      }
                                    }}
                                    data-drop-target-id={`loadout:${row.id}:${slot.id}`}
                                    className={`loadout-hero-box relative rounded-xl overflow-hidden border-2 bg-neutral-900 cursor-pointer transition-all p-1 shadow flex items-center justify-center group/slot ${
                                      hoveredTargetId === `loadout:${row.id}:${slot.id}`
                                        ? "border-white ring-2 ring-white/70 bg-neutral-800 scale-105 shadow-xl"
                                        : "border-neutral-700 hover:border-white"
                                    }`}
                                    title={t.applyTowerTooltip}
                                  >
                                    {slot.image ? (
                                      <img src={slot.image} alt={slot.name} className="max-w-full max-h-full w-auto h-auto object-contain select-none" />
                                    ) : null}

                                    <div className="absolute inset-0 bg-black/75 opacity-0 group-hover/slot:opacity-100 transition-opacity flex items-center justify-center text-white">
                                      <Upload className="w-3.5 h-3.5" />
                                    </div>
                                  </div>
                                  </div>

                                  <input
                                    id={`loadout-file-${row.id}-${slot.id}`}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => handleLoadoutSlotUpload(row.id, slot.id, e)}
                                  />

                                  {/* Hero name: wraps onto a second line instead of being truncated.
                                      Hidden while the slot is empty so empty slots show no label. */}
                                  {(slot.image || slot.name) && (
                                  <AutoGrowTextarea
                                    value={slot.name}
                                    onKeyDown={blurOnEnter}
                                    onChange={e => {
                                      const val = e.target.value;
                                      updateLoadoutSlotAndSync(row.id, slot.id, { name: val });
                                    }}
                                    placeholder={t.towerNamePlaceholder}
                                    className="loadout-name w-full bg-transparent text-[10px] text-center font-bold leading-tight text-neutral-300 focus:text-white focus:outline-none mt-1 border-b border-transparent hover:border-neutral-700 focus:border-white resize-none overflow-hidden break-words"
                                  />
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </ResizableTableFrame>
              </div>
            )}

            {/* 3. STRATEGY HEADER */}
            {!hiddenSections['strategy'] && (
              <div className="group/sec text-center space-y-2 pt-4 relative p-3 rounded-2xl hover:bg-neutral-950/40 transition-colors">
                <div className="relative inline-flex items-center justify-center">
                  <input
                    type="text"
                    value={doc.tab2.strategyTitle}
                    onChange={e => updateTab2({ strategyTitle: e.target.value })}
                    placeholder={t.strategyTitlePlaceholder}
                    className="bg-transparent text-3xl md:text-4xl font-black text-center text-white tracking-widest uppercase focus:outline-none focus:bg-neutral-900 rounded-xl px-4 py-1 border border-transparent hover:border-neutral-800"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSection('strategy', true)}
                    className="opacity-0 group-hover/sec:opacity-100 ml-2 p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-700"
                    title={t.deleteStrategy}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 4. PLAYER STRATEGY BLOCKS */}
            {!hiddenSections['strategy'] &&
              doc.tab2.players.map(player => (
                <div
                  key={player.id}
                  id={`player-block-${player.id}`}
                  className="space-y-4 p-5 md:p-6 rounded-3xl border-2 border-neutral-700 bg-neutral-950 shadow-2xl relative group/player"
                >
                  {/* Top Header Actions: Duplicate & Delete */}
                  <div className="flex items-center justify-end gap-2 pb-3 border-b border-neutral-800">
                    <button
                      type="button"
                      onClick={() => duplicatePlayer(player.id)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 hover:border-white flex items-center gap-1.5 text-xs font-mono transition-all shadow"
                      title={t.duplicateBtn}
                    >
                      <Copy className="w-3.5 h-3.5 text-white" />
                      <span>{t.duplicateBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deletePlayer(player.id)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-700 hover:border-red-500/50 flex items-center gap-1.5 text-xs font-mono transition-all shadow"
                      title={t.deleteBtn}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.deleteBtn}</span>
                    </button>
                  </div>

                  {/* Player Title & Subtitle */}
                  <div className="text-center space-y-1">
                    <input
                      type="text"
                      value={player.playerTitle}
                      onChange={e => updatePlayer(player.id, { playerTitle: e.target.value })}
                      placeholder={t.playerTitlePlaceholder}
                      className="bg-transparent text-2xl md:text-3xl font-black text-center text-white tracking-wider uppercase focus:outline-none focus:bg-neutral-900 rounded-xl px-4 py-1 border-b border-transparent hover:border-neutral-800 focus:border-white"
                    />
                    <div>
                      <input
                        type="text"
                        value={player.difficultyBadge}
                        onChange={e => updatePlayer(player.id, { difficultyBadge: e.target.value })}
                        placeholder={t.difficultyBadgePlaceholder}
                        className="bg-transparent text-xs text-center text-neutral-400 font-bold focus:outline-none focus:bg-neutral-900 rounded px-2"
                      />
                    </div>
                  </div>

                  {/* 5 Tower Cards */}
                  <div className="flex flex-wrap items-center justify-center gap-3 py-2">
                    {player.towers.map((tower, tIdx) => (
                      <div key={tower.id || tIdx} className="flex flex-col items-center">
                        <div className="relative group/rm">
                        {tower.image && (
                          <button
                            type="button"
                            onClick={() => {
                              const newTowers = [...player.towers];
                              newTowers[tIdx] = { ...newTowers[tIdx], image: '', name: '' };
                              updatePlayer(player.id, { towers: newTowers });
                            }}
                            className={`${removeImgBtnClass} -top-1.5 -right-1.5`}
                            title={t.removeImage}
                            aria-label={t.removeImage}
                          >
                            <ImageOff className="w-3 h-3" />
                          </button>
                        )}
                        <div
                          onClick={() => {
                            if (heroAsset) {
                              const newTowers = [...player.towers];
                              newTowers[tIdx] = {
                                ...newTowers[tIdx],
                                image: heroAsset.url,
                                name: heroAsset.name
                              };
                              updatePlayer(player.id, { towers: newTowers });
                            } else {
                              document.getElementById(`player-tower-file-${player.id}-${tIdx}`)?.click();
                            }
                          }}
                          data-drop-target-id={`player-tower:${player.id}:${tIdx}`}
                          className={`relative w-14 h-14 md:w-16 md:h-16 rounded-2xl overflow-hidden border-2 bg-neutral-900 cursor-pointer transition-all p-1 shadow-lg flex items-center justify-center group/tw ${
                            hoveredTargetId === `player-tower:${player.id}:${tIdx}`
                              ? "border-white ring-2 ring-white/70 bg-neutral-800 scale-105 shadow-xl"
                              : "border-neutral-700 hover:border-white"
                          }`}
                          title={t.applyTowerTooltip}
                        >
                          {tower.image ? (
                            <img src={tower.image} alt={tower.name} className="max-w-full max-h-full w-auto h-auto object-contain select-none" />
                          ) : null}
                          <div className="absolute inset-0 bg-black/75 opacity-0 group-hover/tw:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Upload className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        </div>

                        <input
                          id={`player-tower-file-${player.id}-${tIdx}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handlePlayerTowerUpload(player.id, tIdx, e)}
                        />

                        {(tower.image || tower.name) && (
                        <input
                          type="text"
                          value={tower.name}
                          onChange={e => {
                            const val = e.target.value;
                            const newTowers = [...player.towers];
                            newTowers[tIdx] = { ...newTowers[tIdx], name: val };
                            updatePlayer(player.id, { towers: newTowers });
                          }}
                          placeholder={t.towerNamePlaceholder}
                          className="w-20 md:w-24 bg-transparent text-[10px] md:text-[11px] font-bold text-center text-neutral-300 focus:text-white focus:outline-none mt-1 truncate border-b border-transparent hover:border-neutral-700 focus:border-white"
                        />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Table with Placement Map, Notes, Wave Rows */}
                  <ResizableTableFrame
                    width={player.tableWidth}
                    onWidthChange={w => updatePlayer(player.id, { tableWidth: w })}
                    minPx={TABLE_MIN_PX.playerBlock}
                    label={t.tableResizeLabel}
                    hint={t.tableResizeHint}
                  >
                    <div className="rounded-2xl overflow-hidden border-2 border-neutral-700 bg-neutral-950 shadow-2xl">
                      <table className="w-full border-collapse">
                        <tbody>
                          {/* Row 1: Placement Map */}
                          {!player.hideMap && (
                            <tr className="border-b border-neutral-800 group/maprow">
                              <td className="w-[28%] min-w-[5rem] p-3 md:p-4 bg-neutral-900 border-r border-neutral-800 align-middle text-center">
                                <div className="relative flex items-center justify-center gap-1">
                                  <WrapTitleInput
                                    value={player.mapTitle ?? 'Placement Map'}
                                    onChange={v => updatePlayer(player.id, { mapTitle: v })}
                                    placeholder={t.placementMapTitlePlaceholder}
                                    className="w-full bg-transparent font-black text-xs md:text-sm text-white text-center placeholder-neutral-500 focus:outline-none focus:bg-neutral-850 rounded px-1 border-b border-transparent hover:border-neutral-700 focus:border-white font-display"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updatePlayer(player.id, { hideMap: true })}
                                    className="opacity-0 group-hover/maprow:opacity-100 p-1 rounded-md text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-all shrink-0"
                                    title={t.deleteMapTooltip}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 md:p-4 bg-black">
                                <PhotoMapCanvas
                                  photoUrl={player.mapPhoto}
                                  tokens={player.tokens}
                                  zones={player.zones || []}
                                  onChangePhoto={newUrl => {
                                    updateTab2({
                                      players: doc.tab2.players.map(p => ({ ...p, mapPhoto: newUrl }))
                                    });
                                  }}
                                  onChangeTokens={newTokens => updatePlayer(player.id, { tokens: newTokens })}
                                  onChangeZones={newZones => updatePlayer(player.id, { zones: newZones })}
                                  onRemovePhoto={() => updatePlayer(player.id, { mapPhoto: '' })}
                                  selectedAssetUrl={heroAsset?.url}
                                  selectedAssetName={heroAsset?.name}
                                  defaultColor="#ffffff"
                                  aspectRatio={getMapByUrl(player.mapPhoto)?.aspectRatio}
                                  hideMapLabels={player.hideMapLabels ?? true}
                                  onToggleHideMapLabels={hide => updatePlayer(player.id, { hideMapLabels: hide })}
                                  onUndo={onUndo}
                                  onRedo={onRedo}
                                  canUndo={canUndo}
                                  canRedo={canRedo}
                                  selectedTokenIds={activeContext?.playerId === player.id ? activeContext.selectedTokenIds || [] : []}
                                  selectedZoneIds={activeContext?.playerId === player.id ? activeContext.selectedZoneIds || [] : []}
                                  onSelectTokenIds={ids => {
                                    onUpdateContext?.(prev => ({
                                      ...prev,
                                      playerId: player.id,
                                      selectedTokenIds: ids,
                                      selectedZoneIds: prev.playerId === player.id ? prev.selectedZoneIds || [] : []
                                    }));
                                  }}
                                  onSelectZoneIds={ids => {
                                    onUpdateContext?.(prev => ({
                                      ...prev,
                                      playerId: player.id,
                                      selectedZoneIds: ids,
                                      selectedTokenIds: prev.playerId === player.id ? prev.selectedTokenIds || [] : []
                                    }));
                                  }}
                                  onDeleteSelected={onDeleteSelectedMapObjects}
                                  loadoutSlots={getLoadoutRowForPlayer(player.id)?.slots}
                                  loadoutPlayerLabel={player.playerTitle}
                                  lang={lang}
                                />
                              </td>
                            </tr>
                          )}

                          {/* Row 2: Notes */}
                          {!player.hideNotes && (
                            <tr className="border-b border-neutral-800 group/notesrow">
                              <td className="w-[28%] min-w-[5rem] p-3 md:p-4 bg-neutral-900 border-r border-neutral-800 align-middle text-center">
                                <div className="relative flex items-center justify-center gap-1">
                                  <input
                                    type="text"
                                    value={player.notesTitle ?? 'Notes'}
                                    onChange={e => updatePlayer(player.id, { notesTitle: e.target.value })}
                                    placeholder={t.notesTitleBlockPlaceholder}
                                    className="w-full bg-transparent font-black text-xs md:text-sm text-white text-center placeholder-neutral-500 focus:outline-none focus:bg-neutral-850 rounded px-1 border-b border-transparent hover:border-neutral-700 focus:border-white font-display"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updatePlayer(player.id, { hideNotes: true })}
                                    className="opacity-0 group-hover/notesrow:opacity-100 p-1 rounded-md text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-all shrink-0"
                                    title={t.deleteNotesTooltip}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 md:p-4 bg-neutral-950 align-middle text-center">
                                <textarea
                                  rows={Math.max(2, (player.notes || '').split('\n').length)}
                                  value={player.notes}
                                  onChange={e => updatePlayer(player.id, { notes: e.target.value })}
                                  placeholder={t.writeHerePlaceholder}
                                  className="w-full bg-transparent text-xs md:text-sm text-neutral-200 text-center placeholder-neutral-500 focus:outline-none rounded p-1 whitespace-pre-wrap leading-relaxed font-display resize-y"
                                />
                              </td>
                            </tr>
                          )}

                          {/* Wave Rows */}
                          {player.waveRows.map((wr, wIdx) => (
                            <tr key={wIdx} className="border-b border-neutral-800 last:border-b-0 group">
                              <td className="w-[28%] min-w-[5rem] p-3 md:p-4 bg-neutral-900 border-r border-neutral-800 align-middle text-center">
                                <div className="relative flex items-center justify-center">
                                  <input
                                    type="text"
                                    value={wr.wave}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const newRows = [...player.waveRows];
                                      newRows[wIdx] = { ...newRows[wIdx], wave: val };
                                      updatePlayer(player.id, { waveRows: newRows });
                                    }}
                                    placeholder={t.wavePlaceholder}
                                    className="w-full bg-transparent font-black text-xs md:text-sm text-white text-center placeholder-neutral-500 focus:outline-none rounded font-display"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newRows = player.waveRows.filter((_, idx) => idx !== wIdx);
                                      updatePlayer(player.id, { waveRows: newRows });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 absolute -left-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-red-400"
                                    title={t.deleteBtn}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              <td className="p-3 md:p-4 bg-neutral-950 align-middle text-center">
                                <textarea
                                  rows={Math.max(1, (wr.instructions || '').split('\n').length)}
                                  value={wr.instructions}
                                  onChange={e => {
                                    const val = e.target.value;
                                    const newRows = [...player.waveRows];
                                    newRows[wIdx] = { ...newRows[wIdx], instructions: val };
                                    updatePlayer(player.id, { waveRows: newRows });
                                  }}
                                  placeholder="write here..."
                                  className="w-full bg-transparent text-xs md:text-sm text-neutral-200 text-center placeholder-neutral-500 focus:outline-none rounded p-1 whitespace-pre-wrap leading-relaxed font-display resize-y"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ResizableTableFrame>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {player.hideMap && (
                      <button
                        type="button"
                        onClick={() => updatePlayer(player.id, { hideMap: false })}
                        className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-mono transition-colors flex items-center gap-1.5 border border-neutral-700 shadow"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Placement Map</span>
                      </button>
                    )}
                    {player.hideNotes && (
                      <button
                        type="button"
                        onClick={() => updatePlayer(player.id, { hideNotes: false })}
                        className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-mono transition-colors flex items-center gap-1.5 border border-neutral-700 shadow"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Notes</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const newRows = [
                          ...player.waveRows,
                          { wave: '', instructions: '' }
                        ];
                        updatePlayer(player.id, { waveRows: newRows });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-bold transition-colors flex items-center gap-1.5 border border-neutral-700 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add wave for {player.playerTitle}</span>
                    </button>
                  </div>
                </div>
              ))}

            {/* Button to add a new player strategy block */}
            {!hiddenSections['strategy'] && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={addNewPlayerBlock}
                  className="px-4 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold border border-neutral-700 hover:border-white flex items-center gap-2 shadow transition-all"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add player strategy block</span>
                </button>
              </div>
            )}

            {/* 5. COMMON ISSUES (Grid placeholders: title and write here...) */}
            {!hiddenSections['commonIssues'] && (
              <div className="group/sec space-y-4 pt-6 relative p-3 rounded-2xl hover:bg-neutral-950/40 transition-colors">
                <div className="text-center relative inline-flex items-center justify-center w-full">
                  <input
                    type="text"
                    value={doc.tab2.commonIssuesTitle}
                    onChange={e => updateTab2({ commonIssuesTitle: e.target.value })}
                    placeholder="COMMON ISSUES"
                    className="bg-transparent text-2xl md:text-3xl font-black text-center text-white tracking-widest uppercase focus:outline-none focus:bg-neutral-900 rounded-xl px-4 py-1 border border-transparent hover:border-neutral-800"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSection('commonIssues', true)}
                    className="opacity-0 group-hover/sec:opacity-100 ml-2 p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-700"
                    title="Delete Common Issues category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <ResizableTableFrame
                  bleed
                  width={doc.tab2.commonIssuesTableWidth}
                  onWidthChange={w => updateTab2({ commonIssuesTableWidth: w })}
                  minPx={TABLE_MIN_PX.commonIssues}
                  label={t.tableResizeLabel}
                  hint={t.tableResizeHint}
                >
                  <div className="rounded-2xl overflow-hidden border-2 border-neutral-700 bg-neutral-950 shadow-2xl">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-900 text-[11px] font-mono uppercase text-neutral-400">
                          {!doc.tab2.hideCommonIssuesTitles && (
                            <th className="p-3 w-[28%] min-w-[5rem] text-center relative group/colhead">
                              <div className="relative inline-flex items-center justify-center gap-1.5 max-w-full">
                                <input
                                  type="text"
                                  value={doc.tab2.commonIssuesTitlesHeader ?? 'Titles'}
                                  onChange={e => updateTab2({ commonIssuesTitlesHeader: e.target.value })}
                                  placeholder="Titles"
                                  className="bg-transparent font-mono uppercase text-[11px] text-neutral-300 font-bold tracking-wider text-center focus:outline-none focus:text-white rounded px-1 transition-colors hover:text-white w-24"
                                  title="Edit column header"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateTab2({ hideCommonIssuesTitles: true })}
                                  className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-all shrink-0"
                                  title="Delete column (leave only Reason)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </th>
                          )}
                          <th className={`p-3 text-center ${!doc.tab2.hideCommonIssuesTitles ? 'border-l border-neutral-800' : 'w-full'}`}>
                            <div className="relative inline-flex items-center justify-center w-full">
                              <input
                                type="text"
                                value={doc.tab2.commonIssuesReasonHeader ?? 'Reason'}
                                onChange={e => updateTab2({ commonIssuesReasonHeader: e.target.value })}
                                placeholder="Reason"
                                className="bg-transparent font-mono uppercase text-[11px] text-neutral-300 font-bold tracking-wider text-center focus:outline-none focus:text-white rounded px-1 transition-colors hover:text-white w-full max-w-[200px]"
                                title="Edit column header"
                              />
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {doc.tab2.commonIssuesRows.map(issue => (
                          <tr key={issue.id} className="border-b border-neutral-800 last:border-b-0 group">
                            {!doc.tab2.hideCommonIssuesTitles && (
                              <td className="w-[28%] min-w-[5rem] p-3 md:p-4 bg-neutral-900 border-r border-neutral-800 align-middle text-center">
                                <div className="relative flex items-center justify-center">
                                  <input
                                    type="text"
                                    value={issue.wave}
                                    onChange={e => updateCommonIssue(issue.id, e.target.value, issue.reason)}
                                    placeholder="title"
                                    className="w-full bg-transparent font-bold text-xs md:text-sm text-white text-center placeholder-neutral-500 focus:outline-none rounded font-display"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeCommonIssue(issue.id)}
                                    className="opacity-0 group-hover:opacity-100 absolute -left-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-red-400"
                                    title="Delete row"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            )}

                            <td className={`p-3 md:p-4 bg-neutral-950 align-middle text-center ${!doc.tab2.hideCommonIssuesTitles ? 'border-l border-neutral-800' : 'w-full'}`}>
                              <div className="relative flex items-center justify-center">
                                <textarea
                                  rows={Math.max(1, (issue.reason || '').split('\n').length)}
                                  value={issue.reason}
                                  onChange={e => updateCommonIssue(issue.id, issue.wave, e.target.value)}
                                  placeholder="write here..."
                                  className="w-full bg-transparent text-xs md:text-sm text-neutral-200 text-center placeholder-neutral-500 focus:outline-none rounded p-1 whitespace-pre-wrap leading-relaxed font-display resize-y"
                                />
                                {doc.tab2.hideCommonIssuesTitles && (
                                  <button
                                    type="button"
                                    onClick={() => removeCommonIssue(issue.id)}
                                    className="opacity-0 group-hover:opacity-100 absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-red-400 p-1 rounded hover:bg-neutral-900 transition-all"
                                    title="Delete row"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ResizableTableFrame>

                <div className="flex justify-end items-center gap-2">
                  {doc.tab2.hideCommonIssuesTitles && (
                    <button
                      type="button"
                      onClick={() => updateTab2({ hideCommonIssuesTitles: false })}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5 border border-neutral-700 shadow"
                      title="Add Titles column back"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Titles column</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addCommonIssue}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-bold transition-colors flex items-center gap-1.5 border border-neutral-700 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add issue reason</span>
                  </button>
                </div>
              </div>
            )}
    </div>
  );

  const renderExtraPageContent = (extraPage: CustomPageBlock, epIdx: number) => (
    <div className="space-y-6 animate-in fade-in duration-200 text-center">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <input
          type="text"
          value={extraPage.title}
          onChange={e => updateExtraPage(extraPage.id, { title: e.target.value })}
          className="bg-transparent text-xl md:text-2xl font-black text-white text-center w-full focus:outline-none font-display"
          placeholder="SECTION TITLE"
        />
        <button
          type="button"
          onClick={() => deleteExtraPage(extraPage.id)}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-900 transition-colors"
          title="Delete page"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <textarea
        rows={6}
        value={extraPage.content}
        onChange={e => updateExtraPage(extraPage.id, { content: e.target.value })}
        placeholder="write text here..."
        className="w-full bg-neutral-950/60 border border-neutral-800 rounded-xl p-3 text-sm text-neutral-200 text-center focus:outline-none focus:border-purple-500 font-display leading-relaxed"
      />
    </div>
  );

  const sheetDim = getSheetDimensions();
  const marginPad = getMarginPadding();
  const themeInfo = getThemeStyles();
  const totalPages = 2 + (doc.extraPages?.length || 0);

  // Grid overlay was removed from Strategy Studio (no toggle anymore) -> never render it
  const renderGrid = () =>
    false ? (
      <div
        className="absolute inset-0 pointer-events-none rounded opacity-25 z-0 print:hidden"
        style={{
          backgroundImage: 'radial-gradient(rgba(168, 85, 247, 0.45) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />
    ) : null;

  const renderPageHeader = (pageText: string) => (
    <div className="flex items-center justify-between pb-4 mb-6 border-b border-neutral-800/80 text-[10px] font-mono text-neutral-500 print:text-neutral-400 select-none">
      <span className="font-bold uppercase tracking-widest text-purple-400">
        STRATUM STUDIO • {canvasSettings.format.toUpperCase()}
      </span>
      {canvasSettings.showPageNumbers && (
        <span className="font-semibold">{pageText}</span>
      )}
    </div>
  );

  const renderPageFooter = (pageNum: string, totalPagesStr: string) => (
    <div className="pt-6 mt-8 border-t border-neutral-800/80 flex items-center justify-between text-[10px] font-mono text-neutral-500 print:text-neutral-400 select-none">
      <span>STRATUM STUDIO</span>
      {canvasSettings.showPageNumbers && (
        <span>Page {pageNum} of {totalPagesStr}</span>
      )}
    </div>
  );

  return (
    <div className="flex-1 min-w-0 space-y-6">
      {/* 1. UNIFIED CANVAS CONTROLS TOOLBAR (A4 Format, Orientation, Margins, Colors, Zoom, Guides, Exports) */}
      <CanvasControlsBar
        settings={canvasSettings}
        onChangeSettings={updateCanvasSettings}
        onExportDocx={handleExportDocx}
        onSave={handleManualSave}
        saveStatus={saveStatus}
        onCopyHtml={handleCopyHtml}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onAddCustomPage={handleAddCustomPage}
        onFitWidth={handleFitWidth}
        isExporting={isExporting}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onResetDoc={onResetDoc}
        documentTitle={doc.tab1.subBannerText && doc.tab1.subBannerText !== 'write here...' ? doc.tab1.subBannerText : 'Strategy Studio Document'}
        lang={lang}
      />

      {/* 2. MAIN CANVAS WORKSPACE */}
      <div
        ref={sheetWrapperRef}
        className="w-full flex flex-col items-center justify-start bg-neutral-950/90 border border-neutral-800 rounded-3xl p-4 sm:p-8 shadow-inner overflow-x-auto min-h-[900px]"
      >
        {/* Format Badge Header */}
        <div
          className="mb-4 flex items-center justify-between w-full text-[11px] font-mono text-neutral-400 print:hidden"
          style={{ maxWidth: sheetDim.maxWidth }}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="font-bold text-white uppercase">{canvasSettings.format}</span>
            <span>({canvasSettings.orientation === 'landscape' ? tCanvas.landscape : tCanvas.portrait})</span>
          </span>
          <span className="flex items-center gap-3 text-neutral-400">
            <span>
              {canvasSettings.layoutMode === 'multi-page'
                ? `${tCanvas.allPages} (${totalPages} pages)`
                : canvasSettings.layoutMode === 'tab1'
                ? tCanvas.page1
                : tCanvas.page2}
            </span>
            <span>Zoom: {Math.round(canvasSettings.zoom * 100)}%</span>
          </span>
        </div>

        {/* Scaled Sheets Container */}
        <div
          className="transition-transform duration-150 origin-top flex flex-col items-center w-full"
          style={{
            transform: canvasSettings.format === 'fluid' ? 'none' : `scale(${canvasSettings.zoom})`
          }}
        >
          {/* MULTI-PAGE A4 FLOW */}
          {canvasSettings.layoutMode === 'multi-page' && (
            <div className="flex flex-col items-center w-full space-y-10">
              {/* PAGE 1 */}
              <div
                className={`relative font-sans select-text transition-all duration-200 shadow-[0_25px_60px_rgba(0,0,0,0.85)] rounded-sm border ${themeInfo.className} a4-page-view`}
                style={{
                  ...sheetDim,
                  padding: marginPad,
                  ...themeInfo.style
                }}
              >
                {renderGrid()}
                {renderPageHeader(`PAGE 1 / ${totalPages}`)}
                {renderTab1Content()}
                {renderPageFooter('1', String(totalPages))}
              </div>

              {/* PAGE BREAK INDICATOR */}
              <div className="w-full flex flex-col items-center justify-center my-2 print:hidden select-none">
                <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-[11px] font-mono text-neutral-400 shadow-xl backdrop-blur">
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-bold text-white tracking-wider">
                    {tCanvas.pageBreakBadge} — {canvasSettings.format.toUpperCase()}
                  </span>
                  <span className="text-neutral-500">
                    ({canvasSettings.orientation === 'landscape' ? tCanvas.landscape : tCanvas.portrait})
                  </span>
                </div>
                <div className="w-48 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent mt-2" />
              </div>

              {/* PAGE 2 */}
              <div
                className={`relative font-sans select-text transition-all duration-200 shadow-[0_25px_60px_rgba(0,0,0,0.85)] rounded-sm border ${themeInfo.className} a4-page-view`}
                style={{
                  ...sheetDim,
                  padding: marginPad,
                  ...themeInfo.style
                }}
              >
                {renderGrid()}
                {renderPageHeader(`PAGE 2 / ${totalPages}`)}
                {renderTab2Content()}
                {renderPageFooter('2', String(totalPages))}
              </div>

              {/* EXTRA PAGES */}
              {doc.extraPages?.map((extraPage, epIdx) => (
                <React.Fragment key={extraPage.id}>
                  <div className="w-full flex flex-col items-center justify-center my-2 print:hidden select-none">
                    <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-[11px] font-mono text-neutral-400 shadow-xl backdrop-blur">
                      <FileText className="w-3.5 h-3.5 text-purple-400" />
                      <span className="font-bold text-white tracking-wider">
                        {tCanvas.pageBreakBadge} — PAGE {3 + epIdx}
                      </span>
                    </div>
                    <div className="w-48 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent mt-2" />
                  </div>

                  <div
                    className={`relative font-sans select-text transition-all duration-200 shadow-[0_25px_60px_rgba(0,0,0,0.85)] rounded-sm border ${themeInfo.className} a4-page-view`}
                    style={{
                      ...sheetDim,
                      padding: marginPad,
                      ...themeInfo.style
                    }}
                  >
                    {renderGrid()}
                    {renderPageHeader(`PAGE ${3 + epIdx} / ${totalPages}`)}
                    {renderExtraPageContent(extraPage, epIdx)}
                    {renderPageFooter(String(3 + epIdx), String(totalPages))}
                  </div>
                </React.Fragment>
              ))}

              {/* Bottom Add Page Button */}
              <div className="pt-2 pb-6 print:hidden">
                <button
                  type="button"
                  onClick={handleAddCustomPage}
                  className="px-5 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-bold border border-neutral-800 hover:border-purple-500/70 shadow-xl flex items-center gap-2 transition-all"
                >
                  <Plus className="w-4 h-4 text-purple-400" />
                  <span>{tCanvas.addCustomPage}</span>
                </button>
              </div>
            </div>
          )}

          {/* PAGE 1 ONLY */}
          {canvasSettings.layoutMode === 'tab1' && (
            <div
              className={`relative font-sans select-text transition-all duration-200 shadow-[0_25px_60px_rgba(0,0,0,0.85)] rounded-sm border ${themeInfo.className} a4-page-view`}
              style={{
                ...sheetDim,
                padding: marginPad,
                ...themeInfo.style
              }}
            >
              {renderGrid()}
              {renderPageHeader(`PAGE 1 / ${totalPages}`)}
              {renderTab1Content()}
              {renderPageFooter('1', String(totalPages))}
            </div>
          )}

          {/* PAGE 2 ONLY */}
          {canvasSettings.layoutMode === 'tab2' && (
            <div
              className={`relative font-sans select-text transition-all duration-200 shadow-[0_25px_60px_rgba(0,0,0,0.85)] rounded-sm border ${themeInfo.className} a4-page-view`}
              style={{
                ...sheetDim,
                padding: marginPad,
                ...themeInfo.style
              }}
            >
              {renderGrid()}
              {renderPageHeader(`PAGE 2 / ${totalPages}`)}
              {renderTab2Content()}
              {renderPageFooter('2', String(totalPages))}
            </div>
          )}
        </div>
      </div>

      {/* Copied HTML Notification Toast */}
      {copiedHtml && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-black px-4 py-2.5 rounded-2xl shadow-2xl font-black text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{t.copiedDocHtmlTitle}</span>
        </div>
      )}
    </div>
  );
};
