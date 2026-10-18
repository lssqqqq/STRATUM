import React from 'react';
import { Wand2, ArrowRight } from 'lucide-react';
import { translations, Language } from '../i18n/translations';
import strategyListCover from '../assets/images/tds_strategy_list_cover_1791741075556.jpg';
import strategyGeneratorCover from '../assets/images/tds_strategy_generator_cover_1791741088329.jpg';

interface MainMenuProps {
  onNavigate: (tab: 'list' | 'generator' | 'editor') => void;
  onNavigateWithFilter?: (tab: 'list', tag?: string, search?: string) => void;
  tacticsCount?: number;
  lang: Language;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onNavigate,
  lang
}) => {
  const t = translations[lang].mainMenu;

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-2 md:py-6 select-none">
      {/* Hero Header with exact text and layout from screenshot */}
      <div className="space-y-4 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.08] select-none cursor-default">
          <div>{t.heroTitle1}</div>
          <div>{t.heroTitle2}</div>
        </h1>
        <p className="text-sm sm:text-base text-neutral-400 font-normal leading-relaxed max-w-2xl select-none cursor-default">
          {t.heroDescription}
        </p>
      </div>

      {/* 2 Main Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Tactics List */}
        <div className="menu-rotating-card rounded-2xl bg-neutral-950/95 p-5 flex flex-col justify-between group shadow-xl hover:shadow-[0_8px_30px_rgba(255,255,255,0.08)] transition-shadow">
          <div>
            {/* Visual Preview Box - Static image without zoom on hover */}
            <div className="rounded-xl overflow-hidden bg-black border border-neutral-800 aspect-[16/9] relative mb-5 flex items-center justify-center group-hover:border-neutral-700 transition-colors">
              <img
                src={strategyListCover}
                alt={t.cards.list.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Title & Description */}
            <h3 className="text-xl font-bold text-white mb-1.5 flex items-center justify-between">
              <span>{t.cards.list.title}</span>
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-6">
              {t.cards.list.description}
            </p>
          </div>

          {/* Action Button - White background monochrome style */}
          <div className="pt-2">
            <button
              onClick={() => onNavigate('list')}
              className="w-full py-3 px-4 rounded-xl bg-white text-black font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 active:scale-[0.98] hover:bg-neutral-200"
            >
              <span className="text-black font-bold">{t.cards.list.button}</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          </div>
        </div>

        {/* Card 2: Strategy Generator */}
        <div className="menu-rotating-card phase-offset rounded-2xl bg-neutral-950/95 p-5 flex flex-col justify-between group shadow-xl hover:shadow-[0_8px_30px_var(--site-accent-glow)] transition-shadow">
          <div>
            {/* Visual Preview Box - Static image without zoom on hover */}
            <div className="rounded-xl overflow-hidden bg-black border border-neutral-800 aspect-[16/9] relative mb-5 flex items-center justify-center group-hover:border-neutral-700 transition-colors">
              <img
                src={strategyGeneratorCover}
                alt={t.cards.generator.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Title & Description */}
            <h3 className="text-xl font-bold text-white mb-1.5">
              {t.cards.generator.title}
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-6">
              {t.cards.generator.description}
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={() => onNavigate('generator')}
              className="w-full py-3 px-4 rounded-xl bg-neutral-900/90 border border-neutral-700/80 text-white font-bold text-sm hover:border-[var(--site-accent)] hover:bg-neutral-800/90 transition-all shadow-sm flex items-center justify-center gap-2 group-hover:shadow-[0_0_18px_var(--site-accent-glow)] active:scale-[0.98]"
            >
              <span>{t.cards.generator.button}</span>
              <Wand2 className="w-4 h-4 text-[var(--site-accent-light)]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
