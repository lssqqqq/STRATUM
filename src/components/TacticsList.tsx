import React, { useState, useMemo } from 'react';
import {
  Search,
  ExternalLink,
  FileText,
  User,
  Copy,
  Check,
  Plus,
  Edit2,
  Trash2,
  X,
  Heart
} from 'lucide-react';
import { Tactic, OFFICIAL_TAGS, TAG_ICONS } from '../types/tds';
import { translations, Language } from '../i18n/translations';
import { TdsGemIcon } from './TdsGemIcon';
import { fetchLikes, toggleLike, LikesMap } from '../lib/likes';


const renderTagIcon = (tag: string) => {
  if (tag === 'Gem Farm' || tag === 'Hardcore') {
    return <TdsGemIcon className="w-3.5 h-3.5 shrink-0" />;
  }
  const icon = TAG_ICONS[tag];
  return icon ? <span className="shrink-0">{icon}</span> : null;
};

interface TacticsListProps {
  tactics: Tactic[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddTactic: (tactic: Tactic) => void | Promise<void>;
  onUpdateTactic: (tactic: Tactic) => void | Promise<void>;
  onDeleteTactic: (id: string) => void | Promise<void>;
  isAdmin?: boolean;
  loading?: boolean;
  loadError?: string | null;
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
  selectedTags?: string[];
  onSelectTags?: (tags: string[]) => void;
  lang: Language;
}

export const TacticsList: React.FC<TacticsListProps> = ({
  tactics,
  searchQuery,
  onSearchChange,
  onAddTactic,
  onUpdateTactic,
  onDeleteTactic,
  isAdmin = false,
  loading = false,
  loadError = null,
  selectedTag: propSelectedTag,
  onSelectTag: propOnSelectTag,
  selectedTags: propSelectedTags,
  onSelectTags: propOnSelectTags,
  lang
}) => {
  const t = translations[lang].tacticsList;
  const tm = translations[lang].modal;

  // Internal tags state for multiple simultaneous selection
  const [internalTags, setInternalTags] = useState<string[]>(() => {
    if (propSelectedTags && propSelectedTags.length > 0) return propSelectedTags;
    if (propSelectedTag) return [propSelectedTag];
    return [];
  });

  const activeTags = propSelectedTags !== undefined
    ? propSelectedTags
    : (propSelectedTag !== undefined ? (propSelectedTag ? [propSelectedTag] : []) : internalTags);

  const updateSelectedTags = (newTags: string[]) => {
    if (propOnSelectTags) {
      propOnSelectTags(newTags);
    }
    if (propOnSelectTag) {
      propOnSelectTag(newTags.length > 0 ? newTags[0] : null);
    }
    setInternalTags(newTags);
  };

  const toggleTag = (tag: string) => {
    if (activeTags.includes(tag)) {
      updateSelectedTags(activeTags.filter(t => t !== tag));
    } else {
      updateSelectedTags([...activeTags, tag]);
    }
  };

  const handleResetTags = () => {
    updateSelectedTags([]);
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleResetAllFilters = () => {
    updateSelectedTags([]);
    onSearchChange('');
  };

  // Editing author / tactic state
  const [editingTactic, setEditingTactic] = useState<Tactic | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [tacticToDelete, setTacticToDelete] = useState<Tactic | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  React.useEffect(() => {
    setFormError(null);
  }, [isAddOpen, editingTactic, tacticToDelete]);

  // Close delete modal on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTacticToDelete(null);
      }
    };
    if (tacticToDelete) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [tacticToDelete]);

  // New Tactic Form State
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState(t.author || 'Author');
  const [newDocsUrl, setNewDocsUrl] = useState('');
  const [newTags, setNewTags] = useState<string[]>(['Fallen', 'Solo']);
  const [newDesc, setNewDesc] = useState('');

  // Likes
  const [likes, setLikes] = useState<LikesMap>({});
  const [likesAvailable, setLikesAvailable] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'liked'>('newest');

  React.useEffect(() => {
    let cancelled = false;
    fetchLikes()
      .then((map) => {
        if (cancelled) return;
        setLikes(map);
        setLikesAvailable(true);
      })
      .catch((err) => {
        // Таблица лайков ещё не создана в Supabase: просто скрываем лайки
        console.warn('Likes unavailable:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleLike = async (e: React.MouseEvent, tacticId: string) => {
    e.stopPropagation();
    const prev = likes[tacticId] ?? { count: 0, liked: false };
    // сразу меняем на экране, потом сверяемся с сервером
    setLikes((m) => ({
      ...m,
      [tacticId]: {
        liked: !prev.liked,
        count: Math.max(0, prev.count + (prev.liked ? -1 : 1))
      }
    }));
    try {
      const real = await toggleLike(tacticId);
      setLikes((m) => ({ ...m, [tacticId]: real }));
    } catch (err) {
      console.error('Failed to toggle like:', err);
      setLikes((m) => ({ ...m, [tacticId]: prev }));
    }
  };

  // Filter tactics by search and multiple tags
  const filteredTactics = useMemo(() => {
    const result = tactics.filter(tactic => {
      const q = searchQuery.toLowerCase().trim();
      const authorText = (tactic.author === 'Ayaka' ? 'Author' : tactic.author).toLowerCase();
      const matchesSearch =
        !q ||
        tactic.title.toLowerCase().includes(q) ||
        authorText.includes(q) ||
        tactic.tags.some(t => t.toLowerCase().includes(q)) ||
        (tactic.description && tactic.description.toLowerCase().includes(q));

      // Multi-tag matching: tactic must match all active selected tags
      const matchesTags =
        activeTags.length === 0 ||
        activeTags.every(selected => tactic.tags.includes(selected));

      return matchesSearch && matchesTags;
    });

    if (sortBy === 'liked') {
      // по лайкам; при равенстве сохраняется исходный порядок (новые выше)
      return [...result].sort(
        (a, b) => (likes[b.id]?.count ?? 0) - (likes[a.id]?.count ?? 0)
      );
    }
    return result;
  }, [tactics, searchQuery, activeTags, sortBy, likes]);

  const handleCopyLink = (e: React.MouseEvent, tactic: Tactic) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tactic.googleDocsUrl);
    setCopiedId(tactic.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateTactic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDocsUrl.trim()) return;

    let docUrl = newDocsUrl.trim();
    if (!docUrl.startsWith('http://') && !docUrl.startsWith('https://')) {
      docUrl = `https://${docUrl}`;
    }

    const created: Tactic = {
      id: `tactic-${Date.now()}`,
      title: newTitle.trim(),
      author: newAuthor.trim() || t.author,
      googleDocsUrl: docUrl,
      tags: newTags.length > 0 ? newTags : ['Solo'],
      description: newDesc.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setSaving(true);
    setFormError(null);
    try {
      await onAddTactic(created);
      setIsAddOpen(false);
      setNewTitle('');
      setNewAuthor(t.author);
      setNewDocsUrl('');
      setNewTags(['Fallen', 'Solo']);
      setNewDesc('');
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTactic) return;
    setSaving(true);
    setFormError(null);
    try {
      await onUpdateTactic(editingTactic);
      setEditingTactic(null);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleTagInNewForm = (tag: string) => {
    if (newTags.includes(tag)) {
      setNewTags(newTags.filter(t => t !== tag));
    } else {
      setNewTags([...newTags, tag]);
    }
  };

  const toggleTagInEditForm = (tag: string) => {
    if (!editingTactic) return;
    const currentTags = editingTactic.tags;
    const updated = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    setEditingTactic({ ...editingTactic, tags: updated });
  };

  return (
    <div className="space-y-6">
      {/* Tags Filter Bar */}
      <div className="border border-neutral-800 bg-neutral-950 p-4 md:p-5 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2 border-b border-neutral-900">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
              {t.filterByTags}
            </span>
            {activeTags.length > 0 && (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full text-black font-bold shadow-sm"
                style={{ backgroundColor: 'var(--site-accent)' }}
              >
                {activeTags.length} active
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {(activeTags.length > 0 || searchQuery.trim().length > 0) && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-neutral-700 hover:border-white text-neutral-300 hover:text-white transition-colors"
              >
                {t.resetAllFilters || 'Reset all filters'}
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="px-3 py-1 text-xs font-mono text-black font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm hover:opacity-90 active:scale-95"
                style={{ backgroundColor: 'var(--site-accent)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addTactic}</span>
              </button>
            )}
          </div>
        </div>

        {/* All requested tags with multi-selection toggle */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={handleResetTags}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all ${
              activeTags.length === 0
                ? 'bg-neutral-200 text-black border-neutral-200 font-bold shadow-sm'
                : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-white'
            }`}
          >
            {t.all}
          </button>
          {OFFICIAL_TAGS.map(tag => {
            const isSelected = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={
                  isSelected
                    ? {
                        backgroundColor: 'var(--site-accent)',
                        borderColor: 'var(--site-accent)'
                      }
                    : undefined
                }
                className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'text-black font-bold'
                    : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-white'
                }`}
                title={isSelected ? `Deselect ${tag}` : `Select ${tag}`}
              >
                {renderTagIcon(tag)}
                <span>{tag}</span>
                {isSelected && (
                  <span className="text-[10px] ml-0.5 opacity-80 font-bold">✕</span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* Results Count & Current Multi-Tag Filter Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-neutral-500 px-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span>{t.foundCount} <strong className="text-white">{filteredTactics.length}</strong></span>
          {activeTags.length > 0 && (
            <span className="text-neutral-400">
              · matching {activeTags.length} {activeTags.length === 1 ? 'tag' : 'tags'}:
            </span>
          )}
          {activeTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-200 hover:text-white hover:border-neutral-500 transition-colors"
              title={`Remove ${tag} filter`}
            >
              <span>{tag}</span>
              <span className="text-[10px] text-neutral-400 hover:text-white">✕</span>
            </button>
          ))}
          {searchQuery && <span className="ml-1 text-neutral-400">· "{searchQuery}"</span>}
        </div>
        {likesAvailable && (
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Sort:</span>
            {([
              ['newest', 'Newest'],
              ['liked', 'Most liked']
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                className={`px-2.5 py-1 rounded-lg border transition-colors ${
                  sortBy === key
                    ? 'bg-neutral-200 text-black border-neutral-200 font-bold'
                    : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="border border-neutral-800 bg-neutral-950 p-12 text-center rounded-2xl">
          <p className="text-sm font-mono text-neutral-400">Loading strategies...</p>
        </div>
      )}
      {!loading && loadError && (
        <div className="border border-red-900/60 bg-neutral-950 p-8 text-center rounded-2xl">
          <p className="text-sm font-mono text-red-400">Could not load strategies: {loadError}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !loadError && filteredTactics.length === 0 && (
        <div className="border border-neutral-800 bg-neutral-950 p-12 text-center rounded-2xl">
          <p className="text-sm font-mono text-neutral-400">
            {t.emptyTitle}
          </p>
        </div>
      )}

      {/* Tactics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTactics.map(tactic => {
          const displayAuthor = tactic.author === 'Ayaka' ? 'Author' : (tactic.author || 'Author');

          return (
            <div
              key={tactic.id}
              className="border border-neutral-800 bg-neutral-950/90 hover:border-neutral-700 rounded-2xl p-5 flex flex-col justify-between transition-colors shadow-sm group"
            >
              <div>
                {/* Title & Quick actions */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                    {tactic.title}
                  </h3>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 shrink-0 text-neutral-500">
                      <button
                        onClick={() => setEditingTactic({ ...tactic, author: tactic.author === 'Ayaka' ? 'Author' : (tactic.author || 'Author') })}
                        title={tm.editTitle}
                        className="p-1 hover:text-white transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTacticToDelete(tactic)}
                        title="Delete"
                        aria-label={`Delete ${tactic.title}`}
                        className="p-1 text-neutral-500 hover:text-red-400 transition-colors rounded hover:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {tactic.tags.map(tag => {
                    const isTagActive = activeTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        style={
                          isTagActive
                            ? {
                                backgroundColor: 'var(--site-accent)',
                                borderColor: 'var(--site-accent)'
                              }
                            : undefined
                        }
                        className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all flex items-center gap-1 ${
                          isTagActive
                            ? 'text-black font-bold shadow-sm'
                            : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:border-neutral-700'
                        }`}
                        title={isTagActive ? `Deselect ${tag} filter` : `Filter by ${tag}`}
                      >
                        {renderTagIcon(tag)}
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Description */}
                {tactic.description && (
                  <p className="text-xs text-neutral-400 line-clamp-2 mb-3 leading-relaxed">
                    {tactic.description}
                  </p>
                )}


                {/* Google Docs Document Row */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-white shrink-0" />
                      <span className="text-xs font-mono text-neutral-200 truncate">
                        {tactic.googleDocsUrl}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(e, tactic)}
                        title={t.copyDocLink}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600 transition-colors"
                      >
                        {copiedId === tactic.id ? (
                          <Check className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <a
                        href={tactic.googleDocsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 text-xs font-mono bg-white text-black hover:bg-neutral-200 font-semibold rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <span>{t.openDoc}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Underneath: Author (Ayaka replaced with Author) */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-900 text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-neutral-500" />
                    <span>
                      {t.authorPrefix} <strong className="text-white font-mono">{displayAuthor}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <button
                        onClick={() => setEditingTactic({ ...tactic, author: displayAuthor })}
                        className="text-[11px] font-mono text-neutral-500 hover:text-neutral-300 underline"
                      >
                        {t.edit}
                      </button>
                    )}
                    {likesAvailable && (() => {
                      const info = likes[tactic.id] ?? { count: 0, liked: false };
                      return (
                        <button
                          type="button"
                          onClick={(e) => handleToggleLike(e, tactic.id)}
                          aria-pressed={info.liked}
                          title={info.liked ? 'Remove like' : 'Like this strategy'}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all active:scale-95 ${
                            info.liked
                              ? 'border-red-500/60 bg-red-500/10 text-red-400'
                              : 'border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
                          }`}
                        >
                          <Heart
                            className="w-3.5 h-3.5"
                            fill={info.liked ? 'currentColor' : 'none'}
                          />
                          <span>{info.count}</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Tactic Modal */}
      {isAdmin && isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-2xl p-6 text-neutral-100">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-4">
              {tm.addTitle}
            </h3>

            <form onSubmit={handleCreateTactic} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                  {tm.fieldTitle}
                </label>
                <input
                  type="text"
                  required
                  placeholder={tm.fieldTitlePlaceholder}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                  {tm.fieldDocsUrl}
                </label>
                <input
                  type="text"
                  required
                  placeholder={tm.fieldDocsPlaceholder}
                  value={newDocsUrl}
                  onChange={e => setNewDocsUrl(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                  {tm.fieldAuthor}
                </label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={e => setNewAuthor(e.target.value)}
                  placeholder={tm.fieldAuthorPlaceholder}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                  {tm.fieldTags}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                  {OFFICIAL_TAGS.map(tag => {
                    const active = newTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleTagInNewForm(tag)}
                        className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors flex items-center gap-1.5 ${
                          active
                            ? 'bg-white text-black border-white font-bold'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        {renderTagIcon(tag)}
                        <span>{active ? `✓ ${tag}` : tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                  {tm.fieldDescription}
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder={tm.fieldDescriptionPlaceholder}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>

              {formError && (
                <p className="text-xs font-mono text-red-400">{formError}</p>
              )}

              <div className="pt-3 border-t border-neutral-900 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-mono rounded-lg border border-neutral-800 text-neutral-400 hover:text-white"
                >
                  {tm.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-mono rounded-lg bg-white text-black hover:bg-neutral-200 font-bold disabled:opacity-60"
                >
                  {tm.btnAdd}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tactic Modal */}
      {isAdmin && editingTactic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-2xl p-6 text-neutral-100">
            <button
              onClick={() => setEditingTactic(null)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-4">
              {tm.editTitle}
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                  {tm.fieldTitle}
                </label>
                <input
                  type="text"
                  required
                  value={editingTactic.title}
                  onChange={e => setEditingTactic({ ...editingTactic, title: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                  {tm.fieldAuthor}
                </label>
                <input
                  type="text"
                  required
                  value={editingTactic.author}
                  onChange={e => setEditingTactic({ ...editingTactic, author: e.target.value })}
                  placeholder={tm.fieldAuthorPlaceholder}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                  {tm.fieldDocsUrl}
                </label>
                <input
                  type="text"
                  required
                  value={editingTactic.googleDocsUrl}
                  onChange={e => setEditingTactic({ ...editingTactic, googleDocsUrl: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
                  {tm.fieldTags}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                  {OFFICIAL_TAGS.map(tag => {
                    const active = editingTactic.tags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleTagInEditForm(tag)}
                        className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors flex items-center gap-1.5 ${
                          active
                            ? 'bg-white text-black border-white font-bold'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        {renderTagIcon(tag)}
                        <span>{active ? `✓ ${tag}` : tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                  {tm.fieldDescription}
                </label>
                <textarea
                  rows={2}
                  value={editingTactic.description || ''}
                  onChange={e => setEditingTactic({ ...editingTactic, description: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>

              {formError && (
                <p className="text-xs font-mono text-red-400">{formError}</p>
              )}

              <div className="pt-3 border-t border-neutral-900 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTactic(null)}
                  className="px-4 py-2 text-xs font-mono rounded-lg border border-neutral-800 text-neutral-400 hover:text-white"
                >
                  {tm.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-mono rounded-lg bg-white text-black hover:bg-neutral-200 font-bold disabled:opacity-60"
                >
                  {tm.btnSave}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isAdmin && tacticToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-heading"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setTacticToDelete(null)}
        >
          <div
            className="relative w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl p-6 text-neutral-100 shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setTacticToDelete(null)}
              className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-neutral-900"
              title="Cancel"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 pr-6">
                <h3
                  id="delete-dialog-heading"
                  className="text-base sm:text-lg font-bold text-white tracking-tight"
                >
                  Are you sure you want to delete?
                </h3>
                <p className="text-xs text-neutral-400 font-mono truncate max-w-[260px] sm:max-w-[300px]">
                  {tacticToDelete.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed mb-6 font-sans">
              This action cannot be undone. The strategy will be permanently removed from your STRATUM tactics vault.
            </p>

            {formError && (
              <p className="text-xs font-mono text-red-400 mb-3">{formError}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-900">
              <button
                type="button"
                onClick={() => setTacticToDelete(null)}
                className="px-4 py-2 text-xs font-mono rounded-lg border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setFormError(null);
                  try {
                    await onDeleteTactic(tacticToDelete.id);
                    setTacticToDelete(null);
                  } catch (err: any) {
                    setFormError(err?.message || 'Failed to delete');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-4 py-2 text-xs font-mono rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
