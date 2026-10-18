import React, { useState, useMemo } from 'react';
import {
  Shield,
  Eye,
  Plane,
  Flame,
  Zap,
  Coins,
  Megaphone,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
  RotateCcw,
  Target
} from 'lucide-react';
import { assetUrl } from '../utils/assetUrl';

export interface TowerMeta {
  id: string;
  name: string;
  category: 'Golden' | 'Hardcore' | 'Support' | 'DPS' | 'Early' | 'Economy';
  earlyDefense: boolean;
  hiddenDetection: boolean;
  flyingDefense: boolean;
  leadArmor: boolean;
  bossDps: 'low' | 'med' | 'high' | 'ultra';
  isEconomy: boolean;
  isSupport: boolean;
  image?: string;
}

export const TACTICAL_TOWERS: TowerMeta[] = [
  { id: 'accelerator', name: 'Accelerator', category: 'Hardcore', earlyDefense: false, hiddenDetection: true, flyingDefense: false, leadArmor: true, bossDps: 'ultra', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Accelerator.png') },
  { id: 'engineer', name: 'Engineer', category: 'Hardcore', earlyDefense: false, hiddenDetection: true, flyingDefense: true, leadArmor: true, bossDps: 'ultra', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Engineer.png') },
  { id: 'golden-scout', name: 'Golden Scout', category: 'Golden', earlyDefense: true, hiddenDetection: true, flyingDefense: false, leadArmor: false, bossDps: 'low', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Golden Scout.png') },
  { id: 'golden-cowboy', name: 'Golden Cowboy', category: 'Golden', earlyDefense: true, hiddenDetection: true, flyingDefense: false, leadArmor: false, bossDps: 'med', isEconomy: true, isSupport: false, image: assetUrl('/assets/towers/Golden Cowboy.png') },
  { id: 'golden-minigunner', name: 'Golden Minigunner', category: 'Golden', earlyDefense: false, hiddenDetection: true, flyingDefense: false, leadArmor: true, bossDps: 'high', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Golden Minigunner.png') },
  { id: 'farm', name: 'Farm', category: 'Economy', earlyDefense: false, hiddenDetection: false, flyingDefense: false, leadArmor: false, bossDps: 'low', isEconomy: true, isSupport: false, image: assetUrl('/assets/towers/Farm.png') },
  { id: 'commander', name: 'Commander', category: 'Support', earlyDefense: false, hiddenDetection: false, flyingDefense: false, leadArmor: false, bossDps: 'low', isEconomy: false, isSupport: true, image: assetUrl('/assets/towers/Commander.png') },
  { id: 'dj-booth', name: 'DJ Booth', category: 'Support', earlyDefense: false, hiddenDetection: false, flyingDefense: false, leadArmor: false, bossDps: 'low', isEconomy: false, isSupport: true, image: assetUrl('/assets/towers/DJ Booth.png') },
  { id: 'medic', name: 'Medic', category: 'Support', earlyDefense: false, hiddenDetection: false, flyingDefense: false, leadArmor: false, bossDps: 'low', isEconomy: false, isSupport: true, image: assetUrl('/assets/towers/Medic.png') },
  { id: 'ranger', name: 'Ranger', category: 'DPS', earlyDefense: false, hiddenDetection: false, flyingDefense: true, leadArmor: true, bossDps: 'high', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Ranger.png') },
  { id: 'minigunner', name: 'Minigunner', category: 'DPS', earlyDefense: false, hiddenDetection: true, flyingDefense: false, leadArmor: true, bossDps: 'med', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Minigunner.png') },
  { id: 'shotgunner', name: 'Shotgunner', category: 'Early', earlyDefense: true, hiddenDetection: true, flyingDefense: true, leadArmor: false, bossDps: 'low', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Shotgunner.png') },
  { id: 'brawler', name: 'Brawler', category: 'Hardcore', earlyDefense: true, hiddenDetection: true, flyingDefense: false, leadArmor: true, bossDps: 'high', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Brawler.png') },
  { id: 'pyromancer', name: 'Pyromancer', category: 'DPS', earlyDefense: true, hiddenDetection: true, flyingDefense: false, leadArmor: true, bossDps: 'low', isEconomy: false, isSupport: true, image: assetUrl('/assets/towers/Pyromancer.png') },
  { id: 'ace-pilot', name: 'Ace Pilot', category: 'Early', earlyDefense: true, hiddenDetection: true, flyingDefense: true, leadArmor: true, bossDps: 'med', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Ace Pilot.png') },
  { id: 'pursuit', name: 'Pursuit', category: 'DPS', earlyDefense: false, hiddenDetection: true, flyingDefense: true, leadArmor: true, bossDps: 'high', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Pursuit.png') },
  { id: 'gatling-gun', name: 'Gatling Gun', category: 'Hardcore', earlyDefense: false, hiddenDetection: true, flyingDefense: false, leadArmor: true, bossDps: 'ultra', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Gatling Gun.png') },
  { id: 'warden', name: 'Warden', category: 'DPS', earlyDefense: true, hiddenDetection: true, flyingDefense: false, leadArmor: false, bossDps: 'med', isEconomy: false, isSupport: true, image: assetUrl('/assets/towers/Warden.png') },
  { id: 'turret', name: 'Turret', category: 'DPS', earlyDefense: false, hiddenDetection: true, flyingDefense: false, leadArmor: true, bossDps: 'high', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Turret.png') },
  { id: 'mortar', name: 'Mortar', category: 'DPS', earlyDefense: false, hiddenDetection: false, flyingDefense: true, leadArmor: true, bossDps: 'med', isEconomy: false, isSupport: false, image: assetUrl('/assets/towers/Mortar.png') }
];

export const LOADOUT_PRESETS: { name: string; tag: string; towers: string[] }[] = [
  { name: 'Lucille Hardcore (Player 1)', tag: 'Hardcore', towers: ['Accelerator', 'Farm', 'Commander', 'DJ Booth', 'Shotgunner'] },
  { name: 'Solo Fallen Rework Triumph', tag: 'Fallen', towers: ['Shotgunner', 'Farm', 'Commander', 'DJ Booth', 'Ranger'] },
  { name: 'Badlands II Quickdraw Squad', tag: 'Badlands II', towers: ['Golden Cowboy', 'Accelerator', 'Commander', 'DJ Booth', 'Engineer'] },
  { name: 'PW2 Nuclear Monster Clear', tag: 'Polluted Wastelands II', towers: ['Medic', 'Accelerator', 'Golden Minigunner', 'Commander', 'DJ Booth'] },
  { name: 'Pizza Party Duo Fast Run', tag: 'Pizza Party', towers: ['Accelerator', 'Farm', 'DJ Booth', 'Commander', 'Ace Pilot'] }
];

export interface GamemodeIntel {
  id: string;
  name: string;
  badge: string;
  totalWaves: number;
  duration: string;
  rewards: string;
  threats: { wave: string; name: string; danger: string; counter: string }[];
  squadRoles: { role: string; desc: string; coreTowers: string }[];
}

export const GAMEMODE_INTEL: GamemodeIntel[] = [
  {
    id: 'hardcore',
    name: 'Hardcore Mode',
    badge: 'Endgame 300 Gems',
    totalWaves: 50,
    duration: '~36-42 min',
    rewards: '300 Gems, High EXP, Voidcore progress',
    threats: [
      { wave: 'Wave 10', name: 'Hidden Rush', danger: 'Invisibles bypass normal targeting', counter: 'Place Ace Pilot Lvl 2 or Shotgunner Lvl 2 early' },
      { wave: 'Wave 13', name: 'Shadow Boss & Lead Rush', danger: 'High HP + Heavy Lead Armor', counter: 'Brawler or Militant with Lead/Fire damage' },
      { wave: 'Wave 24', name: 'Mega Slow & Soul Stealers', danger: 'Massive HP tanking all lanes', counter: 'Upgrade first Accelerator to Lvl 3' },
      { wave: 'Wave 50', name: 'Void Reaver (Final Boss)', danger: '1,200,000 HP + Stun shockwaves', counter: 'Chain Commander CTA constantly, Medic cleanse' }
    ],
    squadRoles: [
      { role: 'Player 1 (Eco & Early)', desc: 'Carries waves 1-15 and maxes Farms for DPS funding', coreTowers: 'Golden Scout / Shotgunner, Farm' },
      { role: 'Player 2 (Support Buffs)', desc: 'Chains Commander Call-to-Arms & optimizes DJ range', coreTowers: 'Commander, DJ Booth, Farm' },
      { role: 'Player 3 (Stun Medic / CC)', desc: 'Cleanses boss stuns and shreds defense with Pyro/Brawler', coreTowers: 'Medic, Pyromancer, Accelerator' },
      { role: 'Player 4 (Heavy Boss DPS)', desc: 'Rushes max Accelerators and Engineers for final phase', coreTowers: 'Accelerator, Engineer, Farm' }
    ]
  },
  {
    id: 'fallen',
    name: 'Fallen Mode (Rework)',
    badge: '1,400 Coins / Triumph',
    totalWaves: 40,
    duration: '~20-24 min',
    rewards: '1,400 Coins, 500 EXP, Fallen Skin Crates',
    threats: [
      { wave: 'Wave 10', name: 'Fallen Shadows', danger: 'Stealth and fast sprint speed', counter: 'Have hidden detection towers leveled up' },
      { wave: 'Wave 13', name: 'Airborne Flyers', danger: 'Aerial units skip ground traps', counter: 'Ranger or Ace Pilot placed along cliff lines' },
      { wave: 'Wave 30', name: 'Fallen Tank', danger: 'Heavy shield absorption', counter: 'Maxed Ranger / Accelerator burst damage' },
      { wave: 'Wave 40', name: 'Fallen King', danger: 'Rage charge, minion summoning, fire sword', counter: 'Full Commander CTA cycle + maxed Accelerators' }
    ],
    squadRoles: [
      { role: 'Early Defense', desc: 'Prevents early leaks up to Wave 15', coreTowers: 'Shotgunner, Golden Scout, Ace Pilot' },
      { role: 'Economy & Buffs', desc: 'Provides cash flow and 55% firerate boost', coreTowers: 'Farm, Commander, DJ Booth' },
      { role: 'Late Game Firepower', desc: 'Melts tanks and Fallen King', coreTowers: 'Accelerator, Ranger, Minigunner' }
    ]
  },
  {
    id: 'badlands-2',
    name: 'Badlands II',
    badge: 'Cowboy & Quickdraw',
    totalWaves: 40,
    duration: '~26 min',
    rewards: 'Unlocks Cowboy Tower & Quickdraw Badge',
    threats: [
      { wave: 'Wave 12', name: 'Bandit Rush', danger: 'Multiple lane divergence', counter: 'Spread towers near intersection crossroads' },
      { wave: 'Wave 20', name: 'Outlaw Gunslingers', danger: 'Rapid fire snipers from cliffs', counter: 'Heavy explosive crowd control' },
      { wave: 'Wave 40', name: 'Gunslinger Boss', danger: 'Revolver showdown and extreme movement speed', counter: 'Full map Accelerators + Commander Call-to-Arms' }
    ],
    squadRoles: [
      { role: 'Lane Splitters', desc: 'Holds separate track routes simultaneously', coreTowers: 'Golden Cowboy, Brawler, Shotgunner' },
      { role: 'Boss Snipers', desc: 'Eliminates high-value targets across the canyon', coreTowers: 'Ranger, Accelerator, DJ Booth' }
    ]
  },
  {
    id: 'pw2',
    name: 'Polluted Wastelands II',
    badge: 'Nuclear Triumph',
    totalWaves: 40,
    duration: '~28 min',
    rewards: 'Nuclear Monster Badge & Special Skins',
    threats: [
      { wave: 'Wave 14', name: 'Toxic Breakers', danger: 'Acid pools disable ground towers', counter: 'Place towers on high ground / use Medic' },
      { wave: 'Wave 40', name: 'Nuclear Monster', danger: 'Radiation waves stun all towers without Medic', counter: 'Medic Lvl 5 Ability rotation is mandatory' }
    ],
    squadRoles: [
      { role: 'Radiation Cleanse', desc: 'Rotates Medic cure ability to prevent permanent stun', coreTowers: 'Medic, Commander, Farm' },
      { role: 'Heavy Melters', desc: 'High single-target damage ignoring acid shields', coreTowers: 'Accelerator, Golden Minigunner, DJ Booth' }
    ]
  }
];

interface TdsTacticalHubProps {
  onNavigateWithFilter: (tab: 'list', tag?: string, search?: string) => void;
}

export const TdsTacticalHub: React.FC<TdsTacticalHubProps> = ({ onNavigateWithFilter }) => {
  const [activeTab, setActiveTab] = useState<'loadout' | 'intel'>('loadout');
  const [selectedTowerNames, setSelectedTowerNames] = useState<string[]>([
    'Accelerator',
    'Commander',
    'DJ Booth',
    'Farm',
    'Shotgunner'
  ]);
  const [activeIntelMode, setActiveIntelMode] = useState<string>('hardcore');

  // Toggle tower selection (max 5)
  const toggleTower = (name: string) => {
    if (selectedTowerNames.includes(name)) {
      setSelectedTowerNames(selectedTowerNames.filter(n => n !== name));
    } else {
      if (selectedTowerNames.length < 5) {
        setSelectedTowerNames([...selectedTowerNames, name]);
      }
    }
  };

  // Apply preset
  const applyPreset = (preset: typeof LOADOUT_PRESETS[0]) => {
    setSelectedTowerNames(preset.towers);
  };

  // Selected tower objects
  const selectedTowers = useMemo(() => {
    return selectedTowerNames
      .map(name => TACTICAL_TOWERS.find(t => t.name.toLowerCase() === name.toLowerCase()))
      .filter((t): t is TowerMeta => Boolean(t));
  }, [selectedTowerNames]);

  // Tactical Readiness Evaluation
  const evaluation = useMemo(() => {
    const hasEarly = selectedTowers.some(t => t.earlyDefense);
    const hasHidden = selectedTowers.some(t => t.hiddenDetection);
    const hasFlying = selectedTowers.some(t => t.flyingDefense);
    const hasLead = selectedTowers.some(t => t.leadArmor);
    const hasEco = selectedTowers.some(t => t.isEconomy);
    const hasSupport = selectedTowers.some(t => t.isSupport);

    // Boss DPS check
    const ultraDpsCount = selectedTowers.filter(t => t.bossDps === 'ultra').length;
    const highDpsCount = selectedTowers.filter(t => t.bossDps === 'high').length;
    const bossRating = ultraDpsCount >= 1 || highDpsCount >= 2 ? 'S-Tier' : highDpsCount === 1 ? 'A-Tier' : 'B-Tier';

    let score = 0;
    if (hasEarly) score += 15;
    if (hasHidden) score += 20;
    if (hasFlying) score += 20;
    if (hasLead) score += 15;
    if (hasEco) score += 15;
    if (hasSupport) score += 15;

    let tierLabel = 'S+ Tier (Meta Deck)';
    let tierColor = 'text-white border-white bg-white/10';
    if (score < 60 || !hasHidden || !hasFlying) {
      tierLabel = 'Caution: Vulnerable Deck';
      tierColor = 'text-amber-300 border-amber-500/50 bg-amber-500/10';
    } else if (score < 85) {
      tierLabel = 'A Tier (Viable)';
      tierColor = 'text-neutral-200 border-neutral-600 bg-neutral-900';
    }

    return {
      hasEarly,
      hasHidden,
      hasFlying,
      hasLead,
      hasEco,
      hasSupport,
      bossRating,
      score,
      tierLabel,
      tierColor
    };
  }, [selectedTowers]);

  const currentIntel = useMemo(() => {
    return GAMEMODE_INTEL.find(m => m.id === activeIntelMode) || GAMEMODE_INTEL[0];
  }, [activeIntelMode]);

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 md:p-7 space-y-6 shadow-xl relative overflow-hidden">
      {/* Background Subtle Ambient Glow */}
      <div
        className="absolute -top-20 -right-20 w-[28rem] h-[28rem] pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, rgba(255,255,255,0.07) 0%, transparent 65%)' }}
      />

      {/* Header with Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono uppercase tracking-wider text-neutral-300">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>TDS Combat Readiness Center</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
            Tactical Analysis & Threat Intel
          </h2>
          <p className="text-xs text-neutral-400">
            Verify your 5-tower loadout against critical enemy waves or view gamemode survival milestones.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="inline-flex p-1 rounded-xl bg-neutral-900/90 border border-neutral-800 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setActiveTab('loadout')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all flex items-center gap-1.5 ${
              activeTab === 'loadout'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Loadout Evaluator</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('intel')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all flex items-center gap-1.5 ${
              activeTab === 'intel'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Wave Threat Intel</span>
          </button>
        </div>
      </div>

      {/* TAB 1: LOADOUT EVALUATOR */}
      {activeTab === 'loadout' && (
        <div className="space-y-6">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-neutral-400">Meta Presets:</span>
            {LOADOUT_PRESETS.map(preset => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition-colors"
              >
                {preset.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedTowerNames([])}
              className="px-2 py-1 rounded-lg text-[11px] font-mono text-neutral-500 hover:text-neutral-300 flex items-center gap-1 transition-colors ml-auto"
              title="Clear selection"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* 5 Selected Slots */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-300 font-semibold">
                Your 5-Tower Deck ({selectedTowerNames.length} / 5 slots):
              </span>
              <span className="text-neutral-500 text-[11px]">Click towers below to swap</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[0, 1, 2, 3, 4].map(idx => {
                const tower = selectedTowers[idx];
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-2.5 flex items-center gap-2.5 transition-all ${
                      tower
                        ? 'border-neutral-700 bg-neutral-900/90 shadow-sm'
                        : 'border-dashed border-neutral-800 bg-neutral-950/40 text-neutral-600'
                    }`}
                  >
                    {tower ? (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {tower.image ? (
                            <img src={tower.image} alt={tower.name} className="w-full h-full object-cover" />
                          ) : (
                            <Layers className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{tower.name}</p>
                          <span className="text-[10px] font-mono text-neutral-400 block truncate">
                            {tower.category}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleTower(tower.name)}
                          className="text-neutral-500 hover:text-white p-0.5 text-xs font-mono"
                          title="Remove tower"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-mono text-neutral-600 text-center w-full py-1">
                        + Slot {idx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tactical Coverage Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
            {/* Early Defense */}
            <div className={`p-3 rounded-xl border ${evaluation.hasEarly ? 'border-neutral-700 bg-neutral-900/70' : 'border-neutral-800 bg-neutral-950/50 opacity-60'}`}>
              <div className="flex items-center gap-1.5 text-xs font-mono mb-1">
                <Flame className={`w-3.5 h-3.5 ${evaluation.hasEarly ? 'text-white' : 'text-neutral-600'}`} />
                <span className="text-neutral-300 font-bold">Early Waves</span>
              </div>
              <p className="text-[11px] font-mono">
                {evaluation.hasEarly ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Secure</span>
                ) : (
                  <span className="text-neutral-500">Risk leak (W1-10)</span>
                )}
              </p>
            </div>

            {/* Hidden Detection */}
            <div className={`p-3 rounded-xl border ${evaluation.hasHidden ? 'border-neutral-700 bg-neutral-900/70' : 'border-red-900/40 bg-red-950/20'}`}>
              <div className="flex items-center gap-1.5 text-xs font-mono mb-1">
                <Eye className={`w-3.5 h-3.5 ${evaluation.hasHidden ? 'text-white' : 'text-red-400'}`} />
                <span className="text-neutral-300 font-bold">Hidden Detect</span>
              </div>
              <p className="text-[11px] font-mono">
                {evaluation.hasHidden ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Protected</span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Wipes W10+</span>
                )}
              </p>
            </div>

            {/* Flying Defense */}
            <div className={`p-3 rounded-xl border ${evaluation.hasFlying ? 'border-neutral-700 bg-neutral-900/70' : 'border-red-900/40 bg-red-950/20'}`}>
              <div className="flex items-center gap-1.5 text-xs font-mono mb-1">
                <Plane className={`w-3.5 h-3.5 ${evaluation.hasFlying ? 'text-white' : 'text-red-400'}`} />
                <span className="text-neutral-300 font-bold">Flying Targets</span>
              </div>
              <p className="text-[11px] font-mono">
                {evaluation.hasFlying ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Intercepted</span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Wipes W13+</span>
                )}
              </p>
            </div>

            {/* Lead Armor */}
            <div className={`p-3 rounded-xl border ${evaluation.hasLead ? 'border-neutral-700 bg-neutral-900/70' : 'border-neutral-800 bg-neutral-950/50 opacity-60'}`}>
              <div className="flex items-center gap-1.5 text-xs font-mono mb-1">
                <Zap className={`w-3.5 h-3.5 ${evaluation.hasLead ? 'text-white' : 'text-neutral-600'}`} />
                <span className="text-neutral-300 font-bold">Lead Armor</span>
              </div>
              <p className="text-[11px] font-mono">
                {evaluation.hasLead ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Pierces</span>
                ) : (
                  <span className="text-neutral-500">No Lead Pierce</span>
                )}
              </p>
            </div>

            {/* Boss DPS */}
            <div className="p-3 rounded-xl border border-neutral-700 bg-neutral-900/70">
              <div className="flex items-center gap-1.5 text-xs font-mono mb-1">
                <Shield className="w-3.5 h-3.5 text-white" />
                <span className="text-neutral-300 font-bold">Boss DPS</span>
              </div>
              <p className="text-[11px] font-mono text-white font-bold">
                {evaluation.bossRating}
              </p>
            </div>

            {/* Economy & Support */}
            <div className="p-3 rounded-xl border border-neutral-700 bg-neutral-900/70">
              <div className="flex items-center gap-1.5 text-xs font-mono mb-1">
                <Coins className="w-3.5 h-3.5 text-white" />
                <span className="text-neutral-300 font-bold">Eco / Buffs</span>
              </div>
              <p className="text-[11px] font-mono">
                {evaluation.hasEco && evaluation.hasSupport ? (
                  <span className="text-emerald-400">Optimal Eco & CTA</span>
                ) : evaluation.hasEco ? (
                  <span className="text-white">Eco Ready</span>
                ) : evaluation.hasSupport ? (
                  <span className="text-white">Buffs Only</span>
                ) : (
                  <span className="text-neutral-500">No Cash Eco</span>
                )}
              </p>
            </div>
          </div>

          {/* Readiness Banner & Actions */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full border text-xs font-mono font-bold uppercase tracking-wider ${evaluation.tierColor}`}>
                {evaluation.tierLabel}
              </div>
              <p className="text-xs text-neutral-300 font-mono">
                {evaluation.score >= 85
                  ? 'All vital combat checkpoints covered. Ready for Fallen, Hardcore, or Events.'
                  : !evaluation.hasHidden || !evaluation.hasFlying
                  ? 'Critical flaw: Missing Hidden or Flying defense. Enemy balloons or shadows will cause defeat!'
                  : 'Deck is viable, but adding Farm or Commander will greatly boost late-game DPS.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                // Navigate to tactics list and search for top DPS/role tower
                const topTower = selectedTowers.find(t => t.bossDps === 'ultra' || t.name === 'Accelerator' || t.name === 'Engineer') || selectedTowers[0];
                onNavigateWithFilter('list', undefined, topTower ? topTower.name : '');
              }}
              className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs font-mono flex items-center gap-1.5 hover:bg-neutral-200 transition-all active:scale-95 shrink-0 shadow-sm"
            >
              <span>Search Vault For This Deck</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tower Selector Shelf */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-mono text-neutral-400 block">
              Available Towers Catalog (Click to add / remove):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
              {TACTICAL_TOWERS.map(tower => {
                const isSelected = selectedTowerNames.includes(tower.name);
                return (
                  <button
                    key={tower.id}
                    type="button"
                    onClick={() => toggleTower(tower.name)}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'border-white bg-white/10 text-white'
                        : 'border-neutral-800/80 bg-neutral-900/40 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {tower.image ? (
                        <img src={tower.image} alt={tower.name} className="w-full h-full object-cover" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate leading-tight">{tower.name}</p>
                      <span className="text-[10px] font-mono text-neutral-500 block truncate">
                        {tower.bossDps === 'ultra' ? '★ Ultra DPS' : tower.category}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WAVE THREAT INTEL */}
      {activeTab === 'intel' && (
        <div className="space-y-6">
          {/* Gamemode Selector */}
          <div className="flex flex-wrap gap-2">
            {GAMEMODE_INTEL.map(mode => {
              const isActive = mode.id === activeIntelMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setActiveIntelMode(mode.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-2 border ${
                    isActive
                      ? 'bg-white text-black border-white shadow-sm font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  <span>{mode.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded ${isActive ? 'bg-black/10 text-black font-mono' : 'bg-neutral-800 text-neutral-400'}`}>
                    {mode.totalWaves}W
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mode Highlights Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 font-mono text-xs">
            <div>
              <span className="text-neutral-500 block mb-0.5">Objective & Rewards:</span>
              <p className="text-white font-bold">{currentIntel.rewards}</p>
            </div>
            <div>
              <span className="text-neutral-500 block mb-0.5">Average Match Time:</span>
              <p className="text-white font-bold">{currentIntel.duration}</p>
            </div>
            <div className="flex items-center justify-start md:justify-end">
              <button
                type="button"
                onClick={() => {
                  const tagMap: Record<string, string> = {
                    hardcore: 'Hardcore',
                    fallen: 'Fallen',
                    'badlands-2': 'Badlands II',
                    pw2: 'Polluted Wastelands II'
                  };
                  onNavigateWithFilter('list', tagMap[currentIntel.id] || 'Hardcore');
                }}
                className="px-3 py-1.5 rounded-lg bg-white text-black font-bold text-xs flex items-center gap-1.5 hover:bg-neutral-200 transition-colors"
              >
                <span>View {currentIntel.name} Strategies</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Critical Waves Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
              Critical Wipe Checkpoints & Recommended Counters:
            </h4>
            <div className="overflow-x-auto border border-neutral-800 rounded-xl">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400">
                    <th className="py-2.5 px-3">Wave</th>
                    <th className="py-2.5 px-3">Enemy Threat</th>
                    <th className="py-2.5 px-3">Why Squads Wipe</th>
                    <th className="py-2.5 px-3">Required Counter Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {currentIntel.threats.map((threat, idx) => (
                    <tr key={idx} className="hover:bg-neutral-900/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">{threat.wave}</td>
                      <td className="py-2.5 px-3 text-neutral-200 font-semibold">{threat.name}</td>
                      <td className="py-2.5 px-3 text-red-400/90">{threat.danger}</td>
                      <td className="py-2.5 px-3 text-emerald-300">{threat.counter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Squad Roles Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
              Recommended 4-Player Squad Composition:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {currentIntel.squadRoles.map((role, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-1.5">
                  <div className="text-xs font-bold text-white font-mono">{role.role}</div>
                  <p className="text-[11px] text-neutral-400 leading-snug">{role.desc}</p>
                  <div className="pt-1 border-t border-neutral-800 text-[10px] font-mono text-neutral-300">
                    <span className="text-neutral-500">Core: </span>
                    {role.coreTowers}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
