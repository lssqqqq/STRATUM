import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';

export type SiteTheme = 'indigo' | 'emerald' | 'amber' | 'crimson' | 'cyan' | 'monochrome';

export interface ThemeOption {
  id: SiteTheme;
  name: string;
  nameRu: string;
  color: string;
  accent: string;
  bgPreview: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'indigo',
    name: 'Cyber Indigo',
    nameRu: 'Кибер Индиго',
    color: '#6366f1',
    accent: '#818cf8',
    bgPreview: '#07090e'
  },
  {
    id: 'emerald',
    name: 'Tactical Emerald',
    nameRu: 'Тактический Изумруд',
    color: '#10b981',
    accent: '#34d399',
    bgPreview: '#050a08'
  },
  {
    id: 'amber',
    name: 'Solar Amber',
    nameRu: 'Солнечный Янтарь',
    color: '#f59e0b',
    accent: '#fbbf24',
    bgPreview: '#090704'
  },
  {
    id: 'crimson',
    name: 'Ruby Crimson',
    nameRu: 'Рубиновый Багрянец',
    color: '#f43f5e',
    accent: '#fb7185',
    bgPreview: '#0a0507'
  },
  {
    id: 'cyan',
    name: 'Arctic Cyan',
    nameRu: 'Арктический Циан',
    color: '#06b6d4',
    accent: '#38bdf8',
    bgPreview: '#050b14'
  },
  {
    id: 'monochrome',
    name: 'Stealth Noir',
    nameRu: 'Скрытный Нуар',
    color: '#ffffff',
    accent: '#e4e4e7',
    bgPreview: '#030304'
  }
];

interface ThemeSelectorProps {
  currentTheme: SiteTheme;
  onThemeChange: (theme: SiteTheme) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentTheme, onThemeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeOption = THEME_OPTIONS.find(t => t.id === currentTheme) || THEME_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Theme Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={`Theme: ${activeOption.name} (Click to change)`}
        aria-label={`Theme: ${activeOption.name}`}
        className="px-2.5 sm:px-3 py-2 text-[12px] sm:text-[13px] font-semibold rounded-full border border-neutral-800 bg-neutral-900/90 hover:bg-neutral-800/90 text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 sm:gap-2 shadow-sm active:scale-95 group focus:outline-none shrink-0"
      >
        <div className="relative flex items-center justify-center">
          <span
            className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
            style={{
              backgroundColor: activeOption.color
            }}
          />
        </div>
        <Palette className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors" />
        <span className="hidden 2xl:inline text-neutral-300 group-hover:text-white font-medium text-xs">
          {activeOption.name.split(' ')[1]}
        </span>
      </button>

      {/* Floating Theme Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 p-1.5 rounded-2xl bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-neutral-800/80 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[var(--site-accent)]" />
              Theme & Colors
            </span>
          </div>

          <div className="space-y-1">
            {THEME_OPTIONS.map(opt => {
              const isSelected = opt.id === currentTheme;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onThemeChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-all flex items-center justify-between group ${
                    isSelected
                      ? 'bg-neutral-800/90 text-white font-semibold'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                      style={{
                        backgroundColor: opt.color
                      }}
                    />
                    <span className="tracking-wide">{opt.name}</span>
                  </div>
                  {isSelected && (
                    <Check
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: opt.color }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
