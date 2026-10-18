import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Maximize2,
  Sliders,
  Sun,
  Moon,
  Palette,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileDown,
  Copy,
  Layers,
  ChevronDown,
  Check,
  Sparkles,
  Download,
  Plus,
  RefreshCw,
  Save,
  BookOpen,
  Undo2,
  Redo2,
  X
} from 'lucide-react';
import { CanvasSettings, PageFormat, PageOrientation, PageMargin, PageTheme, PageLayoutMode } from '../../types/customDoc';
import { translations, Language } from '../../i18n/translations';
import { GoogleDocsTutorialModal } from './GoogleDocsTutorialModal';

interface CanvasControlsBarProps {
  settings: CanvasSettings;
  onChangeSettings: (updated: Partial<CanvasSettings>) => void;
  onExportDocx: () => void;
  onSave?: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved';
  onCopyHtml?: () => void;
  onExportJson?: () => void;
  onImportJson?: (file: File) => void;
  onAddCustomPage?: () => void;
  onFitWidth?: () => void;
  isExporting?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onResetDoc?: () => void;
  documentTitle?: string;
  lang: Language;
}

export const CanvasControlsBar: React.FC<CanvasControlsBarProps> = ({
  settings,
  onChangeSettings,
  onExportDocx,
  onSave,
  saveStatus = 'idle',
  onCopyHtml,
  onExportJson,
  onAddCustomPage,
  onFitWidth,
  isExporting = false,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onResetDoc,
  documentTitle,
  lang
}) => {
  const t = translations[lang].canvas;
  const colorPickerRef = useRef<HTMLInputElement>(null);

  // Dropdown menus, tutorial modal, and reset document modal states
  const [openMarginMenu, setOpenMarginMenu] = useState(false);
  const [openThemeMenu, setOpenThemeMenu] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  React.useEffect(() => {
    if (!isResetModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsResetModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isResetModalOpen]);

  // Margins list
  const marginOptions: { id: PageMargin; label: string }[] = [
    { id: 'normal', label: t.marginNormal },
    { id: 'narrow', label: t.marginNarrow },
    { id: 'moderate', label: t.marginModerate },
    { id: 'wide', label: t.marginWide },
    { id: 'none', label: t.marginNone }
  ];

  // Themes list
  const themeOptions: { id: PageTheme; label: string; color: string; border: string }[] = [
    { id: 'black', label: t.themeBlack, color: '#000000', border: '#262626' },
    { id: 'dark', label: t.themeDark, color: '#0f0f11', border: '#27272a' },
    { id: 'midnight', label: t.themeMidnight, color: '#0d0714', border: '#581c87' },
    { id: 'white', label: t.themeWhite, color: '#ffffff', border: '#d4d4d8' },
    { id: 'paper', label: t.themePaper, color: '#f8fafc', border: '#cbd5e1' },
    { id: 'custom', label: t.themeCustom, color: settings.customBgColor || '#1a102f', border: '#a855f7' }
  ];

  // Zoom helpers
  const handleZoomChange = (delta: number) => {
    const next = Math.min(2.0, Math.max(0.4, Number((settings.zoom + delta).toFixed(2))));
    onChangeSettings({ zoom: next });
  };

  return (
    <div className="w-full bg-neutral-950/95 backdrop-blur-md border border-neutral-800 rounded-3xl p-3 shadow-2xl space-y-3 relative z-30 select-none">
      {/* Top Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Left cluster: Margins, Theme */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 1. Margins Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenMarginMenu(!openMarginMenu);
                setOpenThemeMenu(false);
              }}
              className="py-1.5 px-3 rounded-2xl bg-neutral-900 hover:bg-neutral-850 text-white border border-neutral-800 hover:border-neutral-700 text-xs font-medium transition-all flex items-center gap-1.5"
              title={t.margins}
            >
              <Sliders className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-[11px] hidden md:inline">{t.margins}</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {openMarginMenu && (
              <div className="absolute left-0 mt-2 w-48 bg-neutral-900 border border-neutral-750 rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-neutral-400 border-b border-neutral-800 mb-1">
                  {t.margins}
                </div>
                {marginOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChangeSettings({ margins: opt.id });
                      setOpenMarginMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-colors ${
                      settings.margins === opt.id
                        ? 'bg-purple-600 text-white font-bold'
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {settings.margins === opt.id && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Sheet Color / Theme Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenThemeMenu(!openThemeMenu);
                setOpenMarginMenu(false);
              }}
              className="py-1.5 px-3 rounded-2xl bg-neutral-900 hover:bg-neutral-850 text-white border border-neutral-800 hover:border-neutral-700 text-xs font-medium transition-all flex items-center gap-2"
              title={t.theme}
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-neutral-600 shrink-0"
                style={{
                  backgroundColor:
                    settings.theme === 'black'
                      ? '#000000'
                      : settings.theme === 'dark'
                      ? '#0f0f11'
                      : settings.theme === 'midnight'
                      ? '#0d0714'
                      : settings.theme === 'white'
                      ? '#ffffff'
                      : settings.theme === 'paper'
                      ? '#f8fafc'
                      : settings.customBgColor || '#120924'
                }}
              />
              <span className="text-[11px] hidden lg:inline">
                {themeOptions.find(o => o.id === settings.theme)?.label || t.theme}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {openThemeMenu && (
              <div className="absolute left-0 mt-2 w-52 bg-neutral-900 border border-neutral-750 rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-neutral-400 border-b border-neutral-800 mb-1">
                  {t.theme}
                </div>
                {themeOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (opt.id === 'custom') {
                        colorPickerRef.current?.click();
                      } else {
                        onChangeSettings({ theme: opt.id });
                      }
                      setOpenThemeMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 transition-colors ${
                      settings.theme === opt.id
                        ? 'bg-neutral-800 text-white font-bold border border-purple-500/50'
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border shrink-0"
                      style={{ backgroundColor: opt.color, borderColor: opt.border }}
                    />
                    <span className="flex-1">{opt.label}</span>
                    {settings.theme === opt.id && <Check className="w-3 h-3 text-purple-400" />}
                  </button>
                ))}
              </div>
            )}

            {/* Hidden native color picker for custom color */}
            <input
              ref={colorPickerRef}
              type="color"
              value={settings.customBgColor || '#0f0f11'}
              onChange={e => {
                onChangeSettings({ theme: 'custom', customBgColor: e.target.value });
              }}
              className="sr-only"
            />
          </div>

          {/* 3. Orientation Selector (Portrait by default / Landscape as option) */}
          <div className="flex items-center bg-neutral-900 p-0.5 rounded-2xl border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => {
                onChangeSettings({ orientation: 'portrait' });
                try {
                  localStorage.setItem('tds_orientation_explicit_v1', 'true');
                } catch {}
              }}
              className={`py-1 px-2.5 rounded-xl transition-all text-[11px] font-bold cursor-pointer ${
                settings.orientation === 'portrait'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title={t.portrait}
            >
              {t.portrait}
            </button>
            <button
              type="button"
              onClick={() => {
                onChangeSettings({ orientation: 'landscape' });
                try {
                  localStorage.setItem('tds_orientation_explicit_v1', 'true');
                } catch {}
              }}
              className={`py-1 px-2.5 rounded-xl transition-all text-[11px] font-bold cursor-pointer ${
                settings.orientation === 'landscape'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title={t.landscape}
            >
              {t.landscape}
            </button>
          </div>
        </div>

        {/* Center cluster: Display Mode (All Pages A4 flow vs Page 1 vs Page 2) */}
        <div className="flex items-center bg-neutral-900 p-1 rounded-2xl border border-neutral-800 text-xs">
          <button
            type="button"
            onClick={() => onChangeSettings({ layoutMode: 'multi-page' })}
            className={`py-1 px-3 rounded-xl transition-all flex items-center gap-1.5 text-[11px] font-bold ${
              settings.layoutMode === 'multi-page'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Display all pages stacked with realistic A4 page breaks"
          >
            <Layers className="w-3 h-3" />
            <span>{t.allPages}</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeSettings({ layoutMode: 'tab1' })}
            className={`py-1 px-2.5 rounded-xl transition-all text-[11px] font-medium ${
              settings.layoutMode === 'tab1'
                ? 'bg-neutral-800 text-white font-bold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.page1}
          </button>

          <button
            type="button"
            onClick={() => onChangeSettings({ layoutMode: 'tab2' })}
            className={`py-1 px-2.5 rounded-xl transition-all text-[11px] font-medium ${
              settings.layoutMode === 'tab2'
                ? 'bg-neutral-800 text-white font-bold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.page2}
          </button>
        </div>

        {/* Right cluster: Zoom, Guides, Exports */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Document Undo / Redo controls */}
          {(onUndo || onRedo) && (
            <div className="flex items-center bg-neutral-900 p-0.5 rounded-2xl border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="p-1.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                title={canUndo ? `${t.undo} (Ctrl+Z)` : t.undo}
                aria-label={t.undo}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                className="p-1.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                title={canRedo ? `${t.redo} (Ctrl+Shift+Z)` : t.redo}
                aria-label={t.redo}
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center bg-neutral-900 p-0.5 rounded-2xl border border-neutral-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => handleZoomChange(-0.1)}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title={t.zoomOut}
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onChangeSettings({ zoom: 1 })}
              className="text-[11px] text-neutral-200 font-bold px-2 hover:text-purple-400 transition-colors"
              title={t.resetZoom}
            >
              {Math.round(settings.zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => handleZoomChange(0.1)}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title={t.zoomIn}
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            {onFitWidth && (
              <button
                type="button"
                onClick={onFitWidth}
                className="py-1 px-1.5 rounded-xl text-[10px] text-neutral-400 hover:text-white hover:bg-neutral-800 font-mono transition-colors"
                title={t.fitWidth}
              >
                Fit
              </button>
            )}
          </div>

          {/* Quick Save Button */}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className={`py-1.5 px-3 rounded-2xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                saveStatus === 'saved'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                  : 'bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border-neutral-750'
              }`}
              title="Save all changes"
            >
              {saveStatus === 'saved' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  <span>Saved!</span>
                </>
              ) : saveStatus === 'saving' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-400" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Save</span>
                </>
              )}
            </button>
          )}

          {/* Single Direct DOCX Export Button (Immediate download, no dialogs or extra menus) */}
          <button
            type="button"
            onClick={onExportDocx}
            disabled={isExporting}
            className="py-1.5 px-3.5 rounded-2xl bg-white hover:bg-neutral-200 text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-lg active:scale-95 disabled:opacity-60 cursor-pointer"
            title="Download formatted DOCX strategy document immediately"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5 text-black" />
                <span>Export DOCX</span>
              </>
            )}
          </button>

          {/* Tutorial Button (Opens Google Docs & Pageless mode guide) */}
          <button
            type="button"
            onClick={() => setIsTutorialOpen(true)}
            className="py-1.5 px-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-750 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            title="Open strategy in Google Docs (Pageless guide)"
          >
            <BookOpen className="w-3.5 h-3.5 text-neutral-300" />
            <span>Tutorial</span>
          </button>

          {/* Reset Document Button with Red Border */}
          {onResetDoc && (
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="py-1.5 px-3 rounded-2xl bg-neutral-900/90 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-500/70 hover:border-red-400 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ml-auto sm:ml-0"
              title="Reset document to default template"
              aria-label="Reset Document"
            >
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
              <span>Reset Document</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom Dimension Inputs if format === 'custom' */}
      {settings.format === 'custom' && (
        <div className="flex items-center gap-3 pt-2 border-t border-neutral-850 text-xs font-mono">
          <span className="text-neutral-400">{t.formatCustom}:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">{t.widthMm}:</span>
            <input
              type="number"
              value={settings.customWidthMm || 210}
              onChange={e => onChangeSettings({ customWidthMm: Number(e.target.value) || 210 })}
              className="w-20 bg-neutral-900 border border-neutral-750 rounded-lg px-2 py-1 text-white text-xs font-bold focus:outline-none focus:border-purple-500"
              min="100"
              max="1000"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">{t.heightMm}:</span>
            <input
              type="number"
              value={settings.customHeightMm || 297}
              onChange={e => onChangeSettings({ customHeightMm: Number(e.target.value) || 297 })}
              className="w-20 bg-neutral-900 border border-neutral-750 rounded-lg px-2 py-1 text-white text-xs font-bold focus:outline-none focus:border-purple-500"
              min="100"
              max="2000"
            />
          </div>
        </div>
      )}

      {/* Tutorial Modal */}
      {isTutorialOpen && (
        <GoogleDocsTutorialModal onClose={() => setIsTutorialOpen(false)} />
      )}

      {/* Reset Document Confirmation Modal (Portaled to document.body for true screen centering, matching Tutorial) */}
      {isResetModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-doc-dialog-heading"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsResetModalOpen(false)}
        >
          <div
            className="relative w-[94vw] max-w-md bg-[#0d0d11] border border-neutral-800 rounded-3xl p-6 text-neutral-100 shadow-2xl my-auto animate-in zoom-in-95 duration-150 font-sans"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white transition-colors rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 cursor-pointer"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3.5 mb-3.5 pr-8">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 font-bold block">
                  Reset Confirmation
                </span>
                <h3
                  id="reset-doc-dialog-heading"
                  className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug"
                >
                  Are you sure you want to reset this document?
                </h3>
                <p className="text-xs text-neutral-400 font-mono truncate max-w-[260px] sm:max-w-[320px]">
                  {documentTitle || 'Strategy Studio Document'}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed mb-6 font-sans">
              This action cannot be undone. All custom sections, wave steps, maps, tower placements, and layout edits will be reset to default template values.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-900">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 text-xs font-mono rounded-xl border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetDoc?.();
                  setIsResetModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-mono rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Document</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
