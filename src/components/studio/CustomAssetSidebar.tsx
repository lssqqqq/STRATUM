import React, { useState, useRef, useEffect } from 'react';
import {
  PhotoAsset,
  TOWER_PHOTOS,
  MAP_PHOTOS,
  getAssetDisplayName,
  TowerRarity,
  TOWER_RARITIES_ORDER,
  TOWER_RARITY_CONFIG
} from '../../data/tdsPhotoAssets';
import { Search, Shield, MapPin, Check, ChevronDown, ChevronRight, Layers, X } from 'lucide-react';
import { translations, Language } from '../../i18n/translations';
import { useStudioDrag } from './StudioDragContext';

interface CustomAssetSidebarProps {
  /** Currently selected tower (or null). */
  selectedTower: PhotoAsset | null;
  /** Currently selected map (or null). */
  selectedMap: PhotoAsset | null;
  /** Called on every click; the parent toggles (select / deselect) the clicked asset. */
  onSelectAsset: (asset: PhotoAsset) => void;
  lang: Language;
}

export const CustomAssetSidebar: React.FC<CustomAssetSidebarProps> = ({
  selectedTower,
  selectedMap,
  onSelectAsset,
  lang
}) => {
  const [activeCategory, setActiveCategory] = useState<'towers' | 'maps'>('towers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRarity, setSelectedRarity] = useState<TowerRarity | 'all'>('all');
  const [collapsedSections, setCollapsedSections] = useState<Partial<Record<TowerRarity, boolean>>>({});
  const { startDrag } = useStudioDrag();
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Enable mouse wheel scrolling horizontally across rarity tabs without showing scrollbar
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (delta !== 0) {
          e.preventDefault();
          el.scrollLeft += delta;
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [activeCategory]);

  const t = translations[lang].studio;

  const toggleSectionCollapse = (rarity: TowerRarity) => {
    setCollapsedSections(prev => ({
      ...prev,
      [rarity]: !prev[rarity]
    }));
  };

  const categories = [
    { id: 'towers', label: t.sidebarTowers, icon: Shield },
    { id: 'maps', label: t.sidebarMaps, icon: MapPin }
  ] as const;

  // Helper to score items for search ranking:
  // 0: Full name starts with query (highest priority, e.g. "Commander", "Cowboy" for "c")
  // 1: A word inside the name starts with query (e.g. "Golden Cowboy" for "c")
  // 2: Query appears inside a word (e.g. "Accelerator", "Necromancer" for "c")
  // 3: Query matches only in tags
  const getSearchRank = (displayName: string, rawName: string, tag?: string) => {
    const dLower = displayName.toLowerCase();
    const rLower = rawName.toLowerCase();
    if (dLower.startsWith(queryLower) || rLower.startsWith(queryLower)) return 0;

    const dWords = dLower.split(/[\s\-_]+/);
    const rWords = rLower.split(/[\s\-_]+/);
    if (dWords.some(w => w.startsWith(queryLower)) || rWords.some(w => w.startsWith(queryLower))) return 1;

    if (dLower.includes(queryLower) || rLower.includes(queryLower)) return 2;
    if (tag && tag.toLowerCase().includes(queryLower)) return 3;
    return 4;
  };

  // Filtered towers by search with prefix priority
  const queryLower = searchQuery.toLowerCase().trim();
  const filteredTowers = React.useMemo(() => {
    if (!queryLower) return TOWER_PHOTOS;

    const matched = TOWER_PHOTOS.filter(asset => {
      const displayName = getAssetDisplayName(asset, lang).toLowerCase();
      const tag = (asset.tag || '').toLowerCase();
      return (
        displayName.includes(queryLower) ||
        asset.name.toLowerCase().includes(queryLower) ||
        tag.includes(queryLower)
      );
    });

    return [...matched].sort((a, b) => {
      const nameA = getAssetDisplayName(a, lang);
      const nameB = getAssetDisplayName(b, lang);
      const rankA = getSearchRank(nameA, a.name, a.tag);
      const rankB = getSearchRank(nameB, b.name, b.tag);

      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
  }, [queryLower, lang]);

  // Filtered maps by search with prefix priority
  const filteredMaps = React.useMemo(() => {
    if (!queryLower) return MAP_PHOTOS;

    const matched = MAP_PHOTOS.filter(asset => {
      const displayName = getAssetDisplayName(asset, lang).toLowerCase();
      return (
        displayName.includes(queryLower) ||
        asset.name.toLowerCase().includes(queryLower)
      );
    });

    return [...matched].sort((a, b) => {
      const nameA = getAssetDisplayName(a, lang);
      const nameB = getAssetDisplayName(b, lang);
      const rankA = getSearchRank(nameA, a.name);
      const rankB = getSearchRank(nameB, b.name);

      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
  }, [queryLower, lang]);

  // Calculate count of towers per rarity for badges
  const rarityCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: filteredTowers.length };
    TOWER_RARITIES_ORDER.forEach(r => {
      counts[r] = filteredTowers.filter(tw => tw.rarity === r).length;
    });
    return counts;
  }, [filteredTowers]);

  return (
    <aside className="studio-sidebar w-full shrink-0 bg-neutral-950 border border-neutral-800 rounded-3xl flex flex-col max-h-[calc(100vh-2.5rem)] shadow-2xl overflow-hidden z-20 lg:rounded-l-none lg:border-l-0">
      {/* Category Tabs: ONLY Towers & Maps (Strict single-language, zero parentheses) */}
      <div className="p-2 border-b border-neutral-800 bg-neutral-900/60 flex gap-2 shrink-0">
        {categories.map(cat => {
          const Icon = cat.icon;
          const isCur = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                setSearchQuery('');
              }}
              className={`flex-1 py-2.5 px-2 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                isCur
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-850'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-neutral-800 bg-neutral-950 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            placeholder={activeCategory === 'towers' ? t.searchTowersPlaceholder : t.searchMapsPlaceholder}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-xl pl-8 pr-8 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none font-mono transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-0.5 rounded-full transition-colors"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 7 RARITY SECTIONS BAR (Directly below search when in Towers tab) */}
      {activeCategory === 'towers' && (
        <div className="p-2 border-b border-neutral-800 bg-neutral-900/40 shrink-0">
          <div
            ref={tabsScrollRef}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-0.5"
          >
            {/* "All" button */}
            <button
              type="button"
              onClick={() => setSelectedRarity('all')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold tracking-tight whitespace-nowrap transition-all border shrink-0 ${
                selectedRarity === 'all'
                  ? 'bg-neutral-100 text-neutral-950 border-neutral-100 shadow-sm'
                  : 'bg-neutral-900/90 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>All</span>
              <span className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded-full ${
                selectedRarity === 'all' ? 'bg-neutral-300 text-neutral-900 font-bold' : 'bg-neutral-800 text-neutral-400'
              }`}>
                {rarityCounts.all}
              </span>
            </button>

            {/* 7 Canonical Rarity Filter Pills */}
            {TOWER_RARITIES_ORDER.map(rarity => {
              const meta = TOWER_RARITY_CONFIG[rarity];
              const isSelected = selectedRarity === rarity;
              const count = rarityCounts[rarity] || 0;

              return (
                <button
                  key={rarity}
                  type="button"
                  onClick={() => setSelectedRarity(prev => (prev === rarity ? 'all' : rarity))}
                  title={meta.description}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold tracking-tight whitespace-nowrap transition-all border shrink-0 ${
                    isSelected
                      ? `${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder} ring-1 ring-white/20 shadow-md`
                      : 'bg-neutral-900/90 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: meta.dotColor }}
                  />
                  <span>{meta.label}</span>
                  <span
                    className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-black/50 text-white font-bold' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid of Ready Photos with 7 Rarity Sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
        {activeCategory === 'towers' ? (
          <>
            {/* Render 7 Rarity Sections */}
            {TOWER_RARITIES_ORDER.filter(rarity => selectedRarity === 'all' || selectedRarity === rarity).map(rarity => {
              const meta = TOWER_RARITY_CONFIG[rarity];
              const towersInSection = filteredTowers.filter(tw => tw.rarity === rarity);
              const isCollapsed = Boolean(collapsedSections[rarity]);

              // If filtering by search and this section has no match, hide it
              if (towersInSection.length === 0 && searchQuery.trim()) {
                return null;
              }

              return (
                <div
                  key={rarity}
                  className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 overflow-hidden transition-all shadow-sm"
                >
                  {/* Rarity Section Header Banner */}
                  <button
                    type="button"
                    onClick={() => toggleSectionCollapse(rarity)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-neutral-900/70 hover:bg-neutral-900 border-b border-neutral-800/80 transition-colors text-left select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ring-2 ring-white/10"
                        style={{ backgroundColor: meta.dotColor }}
                      />
                      <span className="text-xs font-black uppercase tracking-wider text-white">
                        {meta.label}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                      >
                        {towersInSection.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-neutral-400 group-hover:text-white transition-colors">
                      <span className="text-[10px] uppercase font-mono text-neutral-500 hidden sm:inline">
                        {isCollapsed ? 'Show' : 'Hide'}
                      </span>
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>

                  {/* Section Tower Grid */}
                  {!isCollapsed && (
                    <div className="p-2">
                      {towersInSection.length === 0 ? (
                        <div className="text-center py-6 text-xs text-neutral-500 font-mono">
                          {t.nothingFound}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {towersInSection.map(asset => {
                            const displayName = getAssetDisplayName(asset, lang);
                            const isSelected = selectedTower?.id === asset.id;
                            const fullAsset = { ...asset, name: displayName };

                            return (
                              <div
                                key={asset.id}
                                role="button"
                                aria-pressed={isSelected}
                                draggable={false}
                                onDragStart={e => e.preventDefault()}
                                onPointerDown={e => {
                                  if (e.button === 0) startDrag(fullAsset, e);
                                }}
                                onClick={() => onSelectAsset(fullAsset)}
                                className={`group relative rounded-2xl border-2 p-2 cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center touch-none select-none ${
                                  isSelected
                                    ? 'border-white bg-neutral-900 ring-2 ring-white/30 shadow-lg'
                                    : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600 hover:bg-neutral-900'
                                }`}
                              >
                                {/* Photo Barrier Frame */}
                                <div
                                  draggable={false}
                                  onDragStart={e => e.preventDefault()}
                                  className="w-full h-20 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-700/80 mb-1.5 flex items-center justify-center p-1.5 pointer-events-none relative"
                                >
                                  <img
                                    src={asset.url}
                                    alt={displayName}
                                    draggable={false}
                                    onDragStart={e => e.preventDefault()}
                                    className="max-w-full max-h-full w-auto h-auto object-contain group-hover:scale-105 transition-transform select-none pointer-events-none"
                                    loading="lazy"
                                  />
                                  {/* Subtle Rarity Corner Indicator */}
                                  <span
                                    className="absolute bottom-1 right-1 w-2 h-2 rounded-full shadow"
                                    style={{ backgroundColor: meta.dotColor }}
                                    title={meta.label}
                                  />
                                </div>

                                <span className="text-[11px] font-bold text-white truncate max-w-full">
                                  {displayName}
                                </span>

                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 bg-white text-black p-0.5 rounded-full shadow">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Zero matching towers across all sections */}
            {filteredTowers.length === 0 && (
              <div className="text-center py-12 text-xs text-neutral-500 font-mono">
                {t.nothingFound}
              </div>
            )}
          </>
        ) : (
          /* MAPS TAB */
          <>
            <div className="grid grid-cols-2 gap-2">
              {filteredMaps.map(asset => {
                const displayName = getAssetDisplayName(asset, lang);
                const isSelected = selectedMap?.id === asset.id;
                const fullAsset = { ...asset, name: displayName };
                return (
                  <div
                    key={asset.id}
                    role="button"
                    aria-pressed={isSelected}
                    draggable={false}
                    onDragStart={e => e.preventDefault()}
                    onPointerDown={e => {
                      if (e.button === 0) startDrag(fullAsset, e);
                    }}
                    onClick={() => onSelectAsset(fullAsset)}
                    className={`group relative rounded-2xl border-2 p-2 cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center touch-none select-none ${
                      isSelected
                        ? 'border-white bg-neutral-900 ring-2 ring-white/30 shadow-lg'
                        : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600 hover:bg-neutral-900'
                    }`}
                  >
                    {/* Photo Barrier Frame */}
                    <div
                      draggable={false}
                      onDragStart={e => e.preventDefault()}
                      className="w-full h-20 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-700/80 mb-1.5 flex items-center justify-center p-1.5 pointer-events-none"
                    >
                      <img
                        src={asset.url}
                        alt={displayName}
                        draggable={false}
                        onDragStart={e => e.preventDefault()}
                        className="max-w-full max-h-full w-auto h-auto object-contain group-hover:scale-105 transition-transform select-none pointer-events-none"
                        loading="lazy"
                      />
                    </div>

                    <span className="text-[11px] font-bold text-white truncate max-w-full">
                      {displayName}
                    </span>

                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 bg-white text-black p-0.5 rounded-full shadow">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredMaps.length === 0 && (
              <div className="text-center py-12 text-xs text-neutral-500 font-mono">
                {t.nothingFound}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
