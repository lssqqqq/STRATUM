import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MainMenu } from './components/MainMenu';
import { TacticsList } from './components/TacticsList';
import { TacticsGenerator } from './components/TacticsGenerator';
import { TdsA4Editor } from './components/editor/TdsA4Editor';
import { Tactic } from './types/tds';
import type { Session } from '@supabase/supabase-js';
import { AdminLogin } from './components/AdminLogin';
import {
  supabase,
  isAdminUid,
  fetchTactics,
  insertTactic,
  updateTactic,
  deleteTactic
} from './lib/supabase';
import { translations, Language } from './i18n/translations';
import {
  Search,
  X,
  Wand2,
  Database,
  Home,
  Heart,
  Megaphone,
  Mail,
  User,
  LogOut
} from 'lucide-react';
import { RainbowShootingStars } from './components/RainbowShootingStars';
import { SpaceBackground } from './components/SpaceBackground';
import { StratumWordmark } from './components/StratumWordmark';
import { assetUrl } from './utils/assetUrl';

type TabType = 'home' | 'list' | 'generator' | 'editor';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleNavigateWithFilter = (tab: TabType, tag?: string, search?: string) => {
    if (tag) {
      setSelectedTags([tag]);
    }
    if (search !== undefined) {
      setSearchQuery(search);
    }
    setActiveTab(tab);
  };

  // English is the permanent language
  const lang: Language = 'en';
  const t = translations.en;

  // Fixed theme: Sleek Monochrome Black & White
  const siteTheme = 'monochrome';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'monochrome');
  }, []);

  // Tactics are loaded from Supabase (public read)
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [tacticsLoading, setTacticsLoading] = useState(true);
  const [tacticsError, setTacticsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTactics()
      .then(list => {
        if (!cancelled) setTactics(list);
      })
      .catch(err => {
        console.error('Failed to load tactics:', err);
        if (!cancelled) setTacticsError(err?.message || 'Failed to load strategies');
      })
      .finally(() => {
        if (!cancelled) setTacticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Admin session (login is opened via #admin in the URL)
  const [session, setSession] = useState<Session | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const isAdmin = isAdminUid(session?.user?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#admin') setLoginOpen(true);
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const closeLogin = () => {
    setLoginOpen(false);
    if (window.location.hash === '#admin') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  useEffect(() => {
    if (isAdmin && loginOpen) closeLogin();
  }, [isAdmin, loginOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Information section texts per tab (static, non-editable)
  const infoTexts: Record<TabType, string> = {
    home: translations.en.info.homeDefaultText || translations.en.info.defaultText,
    generator: translations.en.info.studioDefaultText || translations.en.info.defaultText,
    list: translations.en.info.listDefaultText,
    editor: translations.en.info.studioDefaultText || translations.en.info.defaultText
  };

  const handleAddTactic = async (newTactic: Tactic) => {
    const created = await insertTactic(newTactic);
    setTactics(prev => [created, ...prev]);
  };

  const handleUpdateTactic = async (updated: Tactic) => {
    const saved = await updateTactic(updated);
    setTactics(prev => prev.map(t => (t.id === saved.id ? saved : t)));
  };

  const handleDeleteTactic = async (id: string) => {
    await deleteTactic(id);
    setTactics(prev => prev.filter(t => t.id !== id));
  };

  const isStudioTab = activeTab === 'generator' || activeTab === 'editor';

  return (
    <div className="min-h-screen bg-[var(--site-bg)] text-white selection:bg-[var(--site-accent)] selection:text-black font-sans antialiased flex flex-col justify-between relative transition-colors duration-300">
      {/* FALLING STARS WITH RADIANT RAINBOW TRAILS (FROM STRATEGIES BUTTON CORNER) */}
      <RainbowShootingStars />

      {/* STATIC DEEP-SPACE BACKDROP: nebula glows + pre-rendered twinkling starfield (no per-frame JS) */}
      <SpaceBackground />

      {/* TACTICAL GRID */}
      <div className="fixed inset-0 pointer-events-none tactical-grid-bg opacity-60 z-0" />

      <div className="relative z-10">
        {/* HEADER NAVIGATION BAR */}
        <header className="sticky top-3 sm:top-4 z-50 px-3 sm:px-6 max-w-6xl mx-auto">
          <div className="rounded-full border border-neutral-800/80 bg-neutral-950/95 px-3 sm:px-5 py-2 min-h-[3.5rem] flex items-center justify-between gap-2 sm:gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
            {/* LEFT: STATIC MINIMALIST STAR LOGO EMBLEM & TITLE (COMPLETELY CLEAN, NO GLOW AURA) */}
            <div className="flex items-center gap-3 shrink-0 select-none cursor-default">
              <div
                className="relative w-10 h-10 flex items-center justify-center shrink-0 pointer-events-none"
                aria-hidden="true"
              >
                {/* Star Logo Emblem matching user photo (Double outline star with 5 surrounding stars) */}
                <div className="relative w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center border border-white/20 bg-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(0,0,0,0.8)]">
                  <img
                    src={assetUrl('/assets/logo.svg')}
                    alt="STRATUM Star Logo"
                    className="w-full h-full object-cover select-none pointer-events-none"
                  />
                  {/* Dynamic Themed Specular Glare Shimmer across the Logo */}
                  <div className="logo-glare-shimmer z-20 pointer-events-none" />
                </div>
              </div>

              {/* Site Name - Exact Montserrat typography matching user reference */}
              <div
                className="flex items-center pointer-events-none select-none h-6 sm:h-7 pl-0.5 text-white"
                aria-label="STRATUM"
              >
                <StratumWordmark
                  className="h-5 sm:h-[22px] w-auto select-none pointer-events-none object-contain text-white"
                />
              </div>
            </div>

            {/* CENTER: NAV TABS */}
            <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-neutral-900/60 border border-neutral-800/80 shrink-0">
              {[
                { id: 'home', label: t.nav.home },
                { id: 'list', label: t.nav.tacticsList },
                { id: 'generator', label: t.nav.generator }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as TabType)}
                    className="relative px-3.5 xl:px-4 py-1.5 text-[13px] font-semibold tracking-[0.01em] rounded-full transition-colors duration-200 select-none focus:outline-none"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNavTabIndicator"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                        className="absolute inset-0 rounded-full bg-neutral-900 border border-neutral-700 shadow-sm"
                      />
                    )}
                    <span
                      className={`relative z-10 transition-colors duration-200 ${
                        isActive ? 'text-white font-bold' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* RIGHT: ACTION BUTTONS */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

              <button
                id="strategies-nav-cta"
                onClick={() => setActiveTab('list')}
                className="px-3.5 sm:px-4 py-2 text-[12px] sm:text-[13px] font-bold rounded-full transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(255,255,255,0.2)] bg-white text-black hover:bg-neutral-200 active:scale-95 shrink-0 group/strat"
                title="View all TDS strategies"
              >
                <span>{t.nav.cta}</span>
                <span aria-hidden="true" className="group-hover/strat:translate-x-0.5 group-hover/strat:-translate-y-0.5 transition-transform">↗</span>
              </button>
            </div>
          </div>

          {/* MOBILE / TABLET TABS MENU (SCREENS BELOW LG) */}
          <div className="flex lg:hidden justify-center mt-2">
            <div className="inline-flex p-1 rounded-full bg-neutral-950 border border-neutral-800">
              {[
                { id: 'home', label: t.nav.home },
                { id: 'list', label: t.nav.tacticsList },
                { id: 'generator', label: t.nav.generator }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as TabType)}
                    className="relative px-3 py-1 text-[12px] font-semibold rounded-full transition-colors duration-200 select-none focus:outline-none"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mobileActiveNavTabIndicator"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                        className="absolute inset-0 rounded-full shadow-sm"
                        style={{ backgroundColor: 'var(--site-accent)' }}
                      />
                    )}
                    <span
                      className={`relative z-10 transition-colors duration-200 ${
                        isActive ? 'text-black font-bold' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* MAIN BODY */}
        {/* Strategy Studio spans the full viewport width so its left sidebar sits on the far-left edge;
            every other tab keeps the centered reading column. */}
        <main className={`${isStudioTab ? 'w-full px-0' : 'max-w-5xl mx-auto px-4'} py-6 md:py-10 space-y-10 transition-all`}>
          {/* SEARCH BAR (Monochrome / Themed style) - hidden in Strategy Studio and Editor */}
          {activeTab !== 'generator' && activeTab !== 'editor' && (
            <section className="space-y-2">
              <div className="relative group">
                <div
                  className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none select-none z-10 text-neutral-300 group-focus-within:text-white transition-colors"
                  aria-hidden="true"
                >
                  <Search className="w-5 h-5 text-neutral-300 group-focus-within:text-white transition-colors shrink-0" strokeWidth={2.2} />
                </div>
                <input
                  type="text"
                  placeholder={t.search.placeholder}
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    if (activeTab === 'home' && e.target.value.trim().length > 0) {
                      handleTabChange('list');
                    }
                  }}
                  className="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-neutral-950/90 border border-neutral-800/80 focus:border-[var(--site-accent)] focus:shadow-[0_0_20px_var(--site-accent-glow)] focus:outline-none text-white placeholder-neutral-500 text-sm font-medium transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-white"
                    title={t.search.clear}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {searchQuery && activeTab !== 'list' && (
                <div className="text-xs font-mono text-neutral-400 px-1 flex items-center justify-between">
                  <span>
                    {t.search.queryLabel} "{searchQuery}"
                  </span>
                  <button
                    onClick={() => handleTabChange('list')}
                    className="text-white underline hover:no-underline"
                  >
                    {t.search.goToList}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* PERSISTENT TABS TO PREVENT LAG ON SWITCHING */}
          <div className={activeTab === 'home' ? 'block' : 'hidden'}>
            <MainMenu
              onNavigate={tab => handleTabChange(tab)}
              onNavigateWithFilter={handleNavigateWithFilter}
              tacticsCount={tactics.length}
              lang={lang}
            />
          </div>

          <div className={activeTab === 'list' ? 'block' : 'hidden'}>
            <TacticsList
              tactics={tactics}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedTags={selectedTags}
              onSelectTags={setSelectedTags}
              onAddTactic={handleAddTactic}
              onUpdateTactic={handleUpdateTactic}
              onDeleteTactic={handleDeleteTactic}
              isAdmin={isAdmin}
              loading={tacticsLoading}
              loadError={tacticsError}
              lang={lang}
            />
          </div>

          <div className={activeTab === 'generator' || activeTab === 'editor' ? 'block' : 'hidden'}>
            <TacticsGenerator lang={lang} />
          </div>

          {/* INFO SECTION */}
          <section className={`rounded-2xl border border-neutral-800 bg-neutral-950 p-6 md:p-8 space-y-4 ${isStudioTab ? 'mx-4 sm:mx-6 lg:mx-auto lg:max-w-7xl' : ''}`}>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white" />
                <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-300 font-bold">
                  {t.info.title}
                </h2>
              </div>
            </div>

            {/* Info Block Content (Read-Only) */}
            <div className="text-sm text-neutral-300 font-sans whitespace-pre-line leading-relaxed">
              {infoTexts[activeTab]}
            </div>
          </section>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-neutral-900 bg-neutral-950 mt-16 py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-neutral-500 font-medium">
              <User className="w-3.5 h-3.5 text-neutral-400" />
              <span>Ayaka & Lsq</span>
            </span>
            <span className="text-neutral-700">·</span>
            <a
              href="https://ko-fi.com/stratumtds"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1.5 hover:text-neutral-300 transition-colors cursor-pointer"
            >
              <Heart className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-300 transition-colors" />
              <span>{t.footer.support}</span>
            </a>
            <span className="text-neutral-700">·</span>
            <a
              href="mailto:stratumstudio1@gmail.com"
              className="flex items-center gap-1.5 hover:text-neutral-200 transition-colors group cursor-pointer"
              title="Contact & Feedback: stratumstudio1@gmail.com"
            >
              <Mail className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-300 transition-colors" />
              <span>Contact & Feedback:</span>
              <span className="text-neutral-300 group-hover:text-white transition-colors">
                stratumstudio1@gmail.com
              </span>
            </a>
          </div>

          {isAdmin && (
            <button
              onClick={handleLogout}
              className="hover:text-neutral-300 flex items-center gap-1 transition-colors text-[11px]"
              title="Log out of admin mode"
            >
              <LogOut className="w-3 h-3" />
              <span>Admin: log out</span>
            </button>
          )}
        </div>
      </footer>

      {loginOpen && !isAdmin && <AdminLogin onClose={closeLogin} />}
    </div>
  );
}
