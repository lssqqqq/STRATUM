import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language } from '../i18n/translations';
import { CustomDocTemplate, DocHistoryEntry, HistoryContext } from '../types/customDoc';
import { PhotoAsset } from '../data/tdsPhotoAssets';
import { loadStudioDoc, loadStudioDocAsync, saveStudioDocAsync } from '../utils/studioStorage';
import { getInitialCustomDoc } from '../data/initialCustomDoc';
import { downloadCustomDocx } from '../utils/customDocExport';
import { CustomAssetSidebar } from './studio/CustomAssetSidebar';
import { CustomDocView } from './studio/CustomDocView';
import { StudioDragProvider } from './studio/StudioDragContext';
import { Tactic } from '../types/tds';

interface TacticsGeneratorProps {
  lang: Language;
  onAddTactic?: (newTactic: Tactic) => void;
}

const HISTORY_LIMIT = 100;

function cloneDoc(doc: CustomDocTemplate): CustomDocTemplate {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(doc);
    } catch {
      // fallback
    }
  }
  return JSON.parse(JSON.stringify(doc));
}

export const isEditingText = (el: EventTarget | null): boolean => {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    el.isContentEditable ||
    Boolean(el.closest('[contenteditable="true"]'))
  );
};

export const TacticsGenerator: React.FC<TacticsGeneratorProps> = ({ lang }) => {
  // Main document state
  const [docTemplate, setDocTemplateState] = useState<CustomDocTemplate>(() => loadStudioDoc(lang));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStorageFallback, setIsStorageFallback] = useState<boolean>(false);
  
  // Async load draft from IndexedDB on initial mount
  useEffect(() => {
    let isCurrent = true;
    loadStudioDocAsync(lang)
      .then(({ doc, isFallback }) => {
        if (!isCurrent) return;
        setDocTemplateState(doc);
        setIsStorageFallback(isFallback);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('[TacticsGenerator] Error loading doc async:', err);
        if (!isCurrent) return;
        setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [lang]);
  
  // Unified document history: up to 100 steps covering both map and Strategy Studio actions
  const [undoStack, setUndoStack] = useState<DocHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<DocHistoryEntry[]>([]);

  // Active interaction context (which player / page / selection is active)
  const [activeContext, setActiveContext] = useState<HistoryContext>({ layoutMode: 'multi-page' });
  const activeContextRef = useRef(activeContext);
  activeContextRef.current = activeContext;

  const [saveError, setSaveError] = useState<string | null>(null);

  const docRef = useRef(docTemplate);
  docRef.current = docTemplate;

  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;

  const redoStackRef = useRef(redoStack);
  redoStackRef.current = redoStack;

  // Text burst typing management:
  // Saves the snapshot BEFORE typing starts; commits as 1 history step after 500ms pause or on blur.
  const typingBurstStartDocRef = useRef<CustomDocTemplate | null>(null);
  const typingBurstContextRef = useRef<HistoryContext | null>(null);
  const typingTimerRef = useRef<number | undefined>(undefined);

  const commitTypingBurst = useCallback(() => {
    if (typingTimerRef.current !== undefined) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = undefined;
    }
    const beforeDoc = typingBurstStartDocRef.current;
    if (!beforeDoc) return;
    const currentDoc = docRef.current;
    const ctx = typingBurstContextRef.current || activeContextRef.current;
    typingBurstStartDocRef.current = null;
    typingBurstContextRef.current = null;

    if (JSON.stringify(beforeDoc) !== JSON.stringify(currentDoc)) {
      setUndoStack(prev => [...prev.slice(-(HISTORY_LIMIT - 1)), { doc: beforeDoc, context: ctx }]);
      setRedoStack([]);
    }
  }, []);

  // Flush typing burst on focusout
  useEffect(() => {
    const handleFocusOut = () => {
      setTimeout(() => {
        if (!isEditingText(document.activeElement)) {
          commitTypingBurst();
        }
      }, 30);
    };
    window.addEventListener('focusout', handleFocusOut);
    return () => window.removeEventListener('focusout', handleFocusOut);
  }, [commitTypingBurst]);

  // Unified document update function
  const setDocTemplate = useCallback(
    (
      updater: React.SetStateAction<CustomDocTemplate>,
      customContext?: HistoryContext
    ) => {
      setDocTemplateState(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next === prev) return prev;

        const isInput = isEditingText(document.activeElement);

        if (isInput) {
          // User is typing in an input/textarea/contenteditable
          if (!typingBurstStartDocRef.current) {
            typingBurstStartDocRef.current = cloneDoc(prev);
            typingBurstContextRef.current = customContext || activeContextRef.current;
          }
          if (typingTimerRef.current !== undefined) {
            window.clearTimeout(typingTimerRef.current);
          }
          typingTimerRef.current = window.setTimeout(() => {
            commitTypingBurst();
          }, 500);
        } else {
          // Discrete user gesture (tower drop, move release, deletion, button click, etc.)
          commitTypingBurst();
          setUndoStack(stack => [
            ...stack.slice(-(HISTORY_LIMIT - 1)),
            { doc: cloneDoc(prev), context: customContext || activeContextRef.current }
          ]);
          setRedoStack([]);
        }

        return next;
      });
    },
    [commitTypingBurst]
  );

  const handleDocUndo = useCallback(() => {
    if (typingBurstStartDocRef.current) {
      commitTypingBurst();
    }
    if (undoStackRef.current.length === 0) return false;

    const previousEntry = undoStackRef.current[undoStackRef.current.length - 1];
    const currentDoc = cloneDoc(docRef.current);
    const currentContext = { ...activeContextRef.current };

    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev.slice(-(HISTORY_LIMIT - 1)), { doc: currentDoc, context: currentContext }]);

    setDocTemplateState(previousEntry.doc);

    if (previousEntry.context) {
      setActiveContext(previousEntry.context);
      if (previousEntry.context.layoutMode && previousEntry.doc.canvasSettings) {
        previousEntry.doc.canvasSettings.layoutMode = previousEntry.context.layoutMode;
      }
      if (previousEntry.context.playerId) {
        setTimeout(() => {
          const el = document.getElementById(`player-block-${previousEntry.context?.playerId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      }
    }
    return true;
  }, [commitTypingBurst]);

  const handleDocRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return false;

    const nextEntry = redoStackRef.current[redoStackRef.current.length - 1];
    const currentDoc = cloneDoc(docRef.current);
    const currentContext = { ...activeContextRef.current };

    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev.slice(-(HISTORY_LIMIT - 1)), { doc: currentDoc, context: currentContext }]);

    setDocTemplateState(nextEntry.doc);

    if (nextEntry.context) {
      setActiveContext(nextEntry.context);
      if (nextEntry.context.layoutMode && nextEntry.doc.canvasSettings) {
        nextEntry.doc.canvasSettings.layoutMode = nextEntry.context.layoutMode;
      }
      if (nextEntry.context.playerId) {
        setTimeout(() => {
          const el = document.getElementById(`player-block-${nextEntry.context?.playerId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      }
    }
    return true;
  }, []);

  // Delete selected towers or zones across any active player map
  const handleDeleteActiveMapSelection = useCallback(() => {
    const ctx = activeContextRef.current;
    if (!ctx.playerId) return false;
    const hasTokens = Boolean(ctx.selectedTokenIds && ctx.selectedTokenIds.length > 0);
    const hasZones = Boolean(ctx.selectedZoneIds && ctx.selectedZoneIds.length > 0);
    if (!hasTokens && !hasZones) return false;

    const targetPlayerId = ctx.playerId;
    const tokenIdsToDelete = ctx.selectedTokenIds || [];
    const zoneIdsToDelete = ctx.selectedZoneIds || [];

    setDocTemplate(prev => {
      const p = prev.tab2.players.find(item => item.id === targetPlayerId);
      if (!p) return prev;
      return {
        ...prev,
        tab2: {
          ...prev.tab2,
          players: prev.tab2.players.map(item =>
            item.id === targetPlayerId
              ? {
                  ...item,
                  tokens: item.tokens.filter(tok => !tokenIdsToDelete.includes(tok.id)),
                  zones: (item.zones || []).filter(z => !zoneIdsToDelete.includes(z.id))
                }
              : item
          )
        }
      };
    }, {
      playerId: targetPlayerId,
      selectedTokenIds: tokenIdsToDelete,
      selectedZoneIds: zoneIdsToDelete
    });

    setActiveContext(prev => ({
      ...prev,
      selectedTokenIds: [],
      selectedZoneIds: []
    }));
    return true;
  }, [setDocTemplate]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput = isEditingText(e.target) || isEditingText(document.activeElement);

      // 1. Delete and Backspace: remove selected tower(s) / zone(s) on the map
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isInput) {
          const ctx = activeContextRef.current;
          if (
            ctx.playerId &&
            ((ctx.selectedTokenIds && ctx.selectedTokenIds.length > 0) ||
              (ctx.selectedZoneIds && ctx.selectedZoneIds.length > 0))
          ) {
            e.preventDefault();
            handleDeleteActiveMapSelection();
            return;
          }
        }
      }

      // 2. Undo / Redo
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (!isCmdOrCtrl) return;

      if (e.key === 'z' || e.key === 'Z') {
        if (isInput) {
          // Native browser undo inside input/textarea
          return;
        }
        if (e.shiftKey) {
          if (redoStackRef.current.length > 0) {
            e.preventDefault();
            handleDocRedo();
          }
        } else {
          if (undoStackRef.current.length > 0) {
            e.preventDefault();
            handleDocUndo();
          }
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        if (isInput) return;
        if (redoStackRef.current.length > 0) {
          e.preventDefault();
          handleDocRedo();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleDocUndo, handleDocRedo, handleDeleteActiveMapSelection]);

  // Autosave: every change is written to IndexedDB (debounced to ~500ms), and the latest state is flushed
  // immediately when the tab is hidden, the page is closed/refreshed, or the studio unmounts.
  const latestDocRef = useRef(docTemplate);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const flushSave = React.useCallback(async () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (!dirtyRef.current) return;
    try {
      const result = await saveStudioDocAsync(latestDocRef.current);
      if (result.ok) {
        dirtyRef.current = false;
        setSaveError(null);
        setIsStorageFallback(Boolean(result.fallback));
      } else {
        setSaveError(result.error || 'Storage write failed');
      }
    } catch (e) {
      console.error('[TacticsGenerator] flushSave error:', e);
      setSaveError(e instanceof Error ? e.message : 'Save error');
    }
  }, []);

  useEffect(() => {
    if (isLoading) return; // Do not trigger autosave during initial load
    latestDocRef.current = docTemplate;
    dirtyRef.current = true;
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flushSave, 500);
  }, [docTemplate, flushSave, isLoading]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    window.addEventListener('pagehide', flushSave);
    window.addEventListener('beforeunload', flushSave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushSave);
      window.removeEventListener('beforeunload', flushSave);
      document.removeEventListener('visibilitychange', onVisibility);
      flushSave();
    };
  }, [flushSave]);

  // Selection from the left panel. Towers and maps are tracked separately so a map can be chosen
  // while a tower stays selected for placing. Clicking the selected item again deselects it.
  const [selectedTower, setSelectedTower] = useState<PhotoAsset | null>(null);
  const [selectedMap, setSelectedMap] = useState<PhotoAsset | null>(null);

  const handleSelectAsset = (asset: PhotoAsset) => {
    if (asset.category === 'maps') {
      if (selectedMap?.id === asset.id) {
        setSelectedMap(null);
        return;
      }
      setSelectedMap(asset);
      setDocTemplate(prev => ({
        ...prev,
        tab2: {
          ...prev.tab2,
          players: prev.tab2.players.map(p => ({ ...p, mapPhoto: asset.url }))
        }
      }));
      return;
    }
    if (asset.category === 'towers') {
      setSelectedTower(prev => (prev?.id === asset.id ? null : asset));
    }
  };

  // Immediate DOCX generation and download, without opening any modal or dialog
  const handleExportDocx = async () => {
    await saveStudioDocAsync(docTemplate);
    await downloadCustomDocx(docTemplate);
  };

  // Reset entire document to pristine template defaults
  const handleResetDoc = useCallback(async () => {
    commitTypingBurst();
    const initialDoc = getInitialCustomDoc(lang);
    setDocTemplate(initialDoc);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedTower(null);
    setSelectedMap(null);
    try {
      await saveStudioDocAsync(initialDoc);
    } catch (err) {
      console.warn('[TacticsGenerator] Failed to save reset doc:', err);
    }
  }, [lang, commitTypingBurst, setDocTemplate]);

  if (isLoading) {
    return (
      <div className="w-full min-h-[520px] flex flex-col items-center justify-center p-12 text-center space-y-4 font-display">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="w-12 h-12 rounded-2xl border-2 border-neutral-800 border-t-white animate-spin" />
        </div>
        <div className="space-y-1">
          <span className="text-sm font-mono font-bold text-white tracking-wider uppercase block">
            Loading Strategy Studio...
          </span>
          <span className="text-xs text-neutral-500 font-mono">
            Restoring your strategy draft from IndexedDB
          </span>
        </div>
      </div>
    );
  }

  return (
    <StudioDragProvider>
      <div className="space-y-6 animate-in fade-in duration-300 w-full strategy-studio-workspace font-display">
        {isStorageFallback && !saveError && (
          <div
            role="alert"
            className="mx-4 sm:mx-6 lg:mx-0 lg:mr-6 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-2.5 text-xs font-mono text-amber-300 flex items-center justify-between gap-3"
          >
            <span>
              ⚠️ IndexedDB is unavailable in this browser session. Strategy draft is using localStorage fallback (~5 MB limit).
            </span>
          </div>
        )}

        {saveError && (
          <div
            role="alert"
            className="mx-4 sm:mx-6 lg:mx-0 lg:mr-6 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-2 text-xs font-mono text-red-300"
          >
            Auto-save note: {saveError}. Changes are kept in memory. Export your strategy to keep a backup.
          </div>
        )}

        {/* Workspace: Left Photo Assets Sidebar + Center/Right Customizable Google Doc Template */}
        <div className="flex flex-col lg:flex-row gap-6 items-start px-4 sm:px-6 lg:px-0 lg:pr-6">
          {/* Left Sidebar: Ready Photos (Towers, Maps) */}
          <CustomAssetSidebar
            selectedTower={selectedTower}
            selectedMap={selectedMap}
            onSelectAsset={handleSelectAsset}
            lang={lang}
          />

          {/* Center / Right: The Complete TDS Google Doc Template */}
          <CustomDocView
            doc={docTemplate}
            onChangeDoc={setDocTemplate}
            selectedAsset={selectedTower}
            selectedMap={selectedMap}
            onGenerateDoc={handleExportDocx}
            onUndo={handleDocUndo}
            onRedo={handleDocRedo}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            activeContext={activeContext}
            onUpdateContext={setActiveContext}
            onDeleteSelectedMapObjects={handleDeleteActiveMapSelection}
            onResetDoc={handleResetDoc}
            lang={lang}
          />
        </div>
      </div>
    </StudioDragProvider>
  );
};
