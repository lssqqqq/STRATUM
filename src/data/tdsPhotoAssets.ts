import { Language } from '../i18n/translations';
import { MAP_CATALOG, getMapByUrl } from './mapCatalog';
import { formatMapName } from '../utils/formatMapName';
import { assetUrl } from '../utils/assetUrl';

export type TowerRarity =
  | 'Starter'
  | 'Intermediate'
  | 'Advanced'
  | 'Hardcore'
  | 'Evolved'
  | 'Golden Perks'
  | 'Exclusive';

export interface TowerRarityMeta {
  id: TowerRarity;
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  dotColor: string;
  description: string;
}

export const TOWER_RARITIES_ORDER: TowerRarity[] = [
  'Starter',
  'Intermediate',
  'Advanced',
  'Hardcore',
  'Evolved',
  'Golden Perks',
  'Exclusive'
];

export const TOWER_RARITY_CONFIG: Record<TowerRarity, TowerRarityMeta> = {
  'Starter': {
    id: 'Starter',
    label: 'Starter',
    badgeBg: 'bg-emerald-950/70',
    badgeBorder: 'border-emerald-500/40',
    badgeText: 'text-emerald-400',
    dotColor: '#10b981',
    description: 'Basic early-game defense towers'
  },
  'Intermediate': {
    id: 'Intermediate',
    label: 'Intermediate',
    badgeBg: 'bg-sky-950/70',
    badgeBorder: 'border-sky-500/40',
    badgeText: 'text-sky-400',
    dotColor: '#0ea5e9',
    description: 'Specialized roles & tactical support'
  },
  'Advanced': {
    id: 'Advanced',
    label: 'Advanced',
    badgeBg: 'bg-purple-950/70',
    badgeBorder: 'border-purple-500/40',
    badgeText: 'text-purple-400',
    dotColor: '#a855f7',
    description: 'Heavy DPS & essential battle powerhouses'
  },
  'Hardcore': {
    id: 'Hardcore',
    label: 'Hardcore',
    badgeBg: 'bg-rose-950/70',
    badgeBorder: 'border-rose-500/40',
    badgeText: 'text-rose-400',
    dotColor: '#f43f5e',
    description: 'Endgame gem triumphs & hardcore mastery'
  },
  'Evolved': {
    id: 'Evolved',
    label: 'Evolved',
    badgeBg: 'bg-pink-950/70',
    badgeBorder: 'border-pink-500/40',
    badgeText: 'text-pink-400',
    dotColor: '#ec4899',
    description: 'Evolved forms & advanced kit mechanics'
  },
  'Golden Perks': {
    id: 'Golden Perks',
    label: 'Golden Perks',
    badgeBg: 'bg-amber-950/70',
    badgeBorder: 'border-amber-400/50',
    badgeText: 'text-amber-300',
    dotColor: '#f59e0b',
    description: 'Golden Crate enhanced variants with perks'
  },
  'Exclusive': {
    id: 'Exclusive',
    label: 'Exclusive',
    badgeBg: 'bg-orange-950/70',
    badgeBorder: 'border-orange-500/40',
    badgeText: 'text-orange-400',
    dotColor: '#f97316',
    description: 'Seasonal event & developer exclusive towers'
  }
};

export interface PhotoAsset {
  id: string;
  name: string;
  category: 'towers' | 'maps' | 'avatars' | 'covers' | 'stickers';
  url: string;
  tag?: string;
  rarity?: TowerRarity;
}

export const getAssetDisplayName = (asset: PhotoAsset, _lang?: Language): string => {
  // Map names are cleaned for display (separators, casing); other assets keep their curated names.
  return asset.category === 'maps' ? formatMapName(asset.name) || asset.name : asset.name;
};

export const getAssetDisplayTag = (asset: PhotoAsset, _lang?: Language): string | undefined => {
  return asset.tag;
};

const svgToDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// Default monochrome banner placeholder (Black & White with barrier border)
export const MONOCHROME_BANNER_PLACEHOLDER = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320">
  <rect width="800" height="320" fill="#000000" stroke="#333333" stroke-width="4"/>
  <rect x="16" y="16" width="768" height="288" rx="12" fill="#0a0a0a" stroke="#262626" stroke-width="2" stroke-dasharray="8,8"/>
  <circle cx="400" cy="130" r="46" fill="#141414" stroke="#525252" stroke-width="2.5"/>
  <path d="M 380 130 L 420 130 M 400 110 L 400 150" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
  <text x="400" y="218" font-size="20" font-family="monospace" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="3">HEADER COVER / LOGO</text>
  <text x="400" y="246" font-size="11" font-family="monospace" fill="#737373" text-anchor="middle">Click to upload photo or select from left sidebar</text>
</svg>`);

// Default monochrome avatar placeholder (barrier border and monochrome logo)
export const MONOCHROME_AVATAR_PLACEHOLDER = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="16" fill="#050505" stroke="#404040" stroke-width="3"/>
  <rect x="6" y="6" width="88" height="88" rx="12" fill="#111111" stroke="#262626" stroke-width="1.5"/>
  <circle cx="50" cy="40" r="18" fill="#1f1f1f" stroke="#737373" stroke-width="2"/>
  <path d="M 26 82 C 26 64 74 64 74 82" fill="#1f1f1f" stroke="#737373" stroke-width="2"/>
</svg>`);

// Default monochrome tower placeholder
export const MONOCHROME_TOWER_PLACEHOLDER = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="16" fill="#050505" stroke="#404040" stroke-width="3"/>
  <rect x="6" y="6" width="88" height="88" rx="12" fill="#111111" stroke="#262626" stroke-width="1.5"/>
  <polygon points="50,22 74,40 66,74 34,74 26,40" fill="#1c1c1c" stroke="#a3a3a3" stroke-width="2"/>
  <circle cx="50" cy="48" r="9" fill="#2a2a2a" stroke="#ffffff" stroke-width="2"/>
  <line x1="50" y1="43" x2="50" y2="53" stroke="#ffffff" stroke-width="2"/>
  <line x1="45" y1="48" x2="55" y2="48" stroke="#ffffff" stroke-width="2"/>
</svg>`);

// Default monochrome map photo placeholder
export const MONOCHROME_MAP_PLACEHOLDER = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 380">
  <rect width="640" height="380" fill="#000000" stroke="#333333" stroke-width="4"/>
  <rect x="12" y="12" width="616" height="356" rx="10" fill="#0d0d0d" stroke="#262626" stroke-width="2"/>
  <!-- Track -->
  <path d="M 40 280 L 190 280 L 190 140 L 370 140 L 370 230 L 590 230" fill="none" stroke="#212121" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 40 280 L 190 280 L 190 140 L 370 140 L 370 230 L 590 230" fill="none" stroke="#404040" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 40 280 L 190 280 L 190 140 L 370 140 L 370 230 L 590 230" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="12,12" stroke-linecap="round"/>
  <!-- Cliff Blocks -->
  <rect x="230" y="55" width="105" height="65" rx="8" fill="#171717" stroke="#525252" stroke-width="2"/>
  <text x="282" y="93" font-size="11" font-family="monospace" font-weight="900" fill="#a3a3a3" text-anchor="middle" letter-spacing="1">CLIFF</text>
  <rect x="230" y="250" width="105" height="65" rx="8" fill="#171717" stroke="#525252" stroke-width="2"/>
  <text x="282" y="288" font-size="11" font-family="monospace" font-weight="900" fill="#a3a3a3" text-anchor="middle" letter-spacing="1">CLIFF</text>
  <!-- Tactical Map Badge -->
  <rect x="24" y="24" width="140" height="28" rx="6" fill="#000000" stroke="#737373" stroke-width="1.5"/>
  <text x="94" y="42" font-size="11" font-family="monospace" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">MAP CANVAS</text>
</svg>`);

// Helper to create pure monochrome tower badges (black & white vector styling with high contrast border)
export const createMonoTower = (name: string, svgContent: string) => {
  return svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="16" fill="#050505" stroke="#404040" stroke-width="3"/>
    <rect x="6" y="6" width="88" height="88" rx="12" fill="#111111" stroke="#262626" stroke-width="1"/>
    <circle cx="50" cy="40" r="23" fill="#1c1c1c" stroke="#525252" stroke-width="2"/>
    <g transform="translate(30, 20)">${svgContent}</g>
    <rect x="8" y="74" width="84" height="17" rx="5" fill="#000000" stroke="#525252" stroke-width="1"/>
    <text x="50" y="86" font-size="8.5" font-family="monospace" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">${name.slice(0, 12).toUpperCase()}</text>
  </svg>`);
};

// Tower vector graphics (crisp monochrome)
const cowboySvg = `<path d="M 2 24 C 8 20 32 20 38 24 C 34 16 32 6 20 6 C 8 6 6 16 2 24 Z" fill="#ffffff" stroke="#ffffff" stroke-width="1"/><rect x="8" y="16" width="24" height="4" fill="#000000"/>`;
const saboteurSvg = `<circle cx="20" cy="20" r="14" fill="#262626" stroke="#ffffff" stroke-width="2"/><circle cx="15" cy="18" r="3" fill="#ffffff"/><circle cx="25" cy="18" r="3" fill="#ffffff"/><path d="M 8 26 L 32 26" stroke="#ffffff" stroke-width="2"/>`;
const juggernautSvg = `<rect x="6" y="6" width="28" height="28" rx="6" fill="#262626" stroke="#ffffff" stroke-width="2"/><line x1="20" y1="6" x2="20" y2="34" stroke="#ffffff" stroke-width="2"/><line x1="6" y1="20" x2="34" y2="20" stroke="#ffffff" stroke-width="2"/>`;
const commanderSvg = `<polygon points="6,14 16,8 16,32 6,26" fill="#ffffff"/><polygon points="16,14 34,4 34,36 16,26" fill="#ffffff" stroke="#000000" stroke-width="1.5"/><line x1="34" y1="20" x2="38" y2="20" stroke="#ffffff" stroke-width="2"/>`;
const hackerSvg = `<rect x="6" y="8" width="28" height="20" rx="3" fill="#000000" stroke="#ffffff" stroke-width="2"/><line x1="12" y1="32" x2="28" y2="32" stroke="#ffffff" stroke-width="2.5"/><line x1="20" y1="28" x2="20" y2="32" stroke="#ffffff" stroke-width="2"/><text x="20" y="22" font-size="10" font-family="monospace" fill="#ffffff" text-anchor="middle">&lt;/&gt;</text>`;
const farmSvg = `<path d="M 20 34 L 20 8 M 20 8 C 14 14 14 20 20 22 M 20 8 C 26 14 26 20 20 22 M 20 18 C 12 24 14 28 20 30 M 20 18 C 28 24 26 28 20 30" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>`;
const engineerSvg = `<path d="M 10 10 L 16 16 L 30 2 L 36 8 L 22 22 L 28 28 Z" fill="#ffffff" stroke="#ffffff" stroke-width="1.5"/>`;
const djSvg = `<circle cx="20" cy="20" r="16" fill="#000000" stroke="#ffffff" stroke-width="2"/><circle cx="20" cy="20" r="6" fill="#ffffff"/><circle cx="20" cy="20" r="2" fill="#000000"/>`;
const medicSvg = `<rect x="8" y="16" width="24" height="8" rx="2" fill="#ffffff"/><rect x="16" y="8" width="8" height="24" rx="2" fill="#ffffff"/>`;
const acceleratorSvg = `<polygon points="20,4 6,20 18,20 14,36 32,16 20,16" fill="#ffffff" stroke="#000000" stroke-width="1"/>`;
const rangerSvg = `<circle cx="20" cy="20" r="14" fill="none" stroke="#ffffff" stroke-width="2"/><circle cx="20" cy="20" r="6" fill="none" stroke="#ffffff" stroke-width="1.5"/><line x1="4" y1="20" x2="36" y2="20" stroke="#ffffff" stroke-width="2"/><line x1="20" y1="4" x2="20" y2="36" stroke="#ffffff" stroke-width="2"/>`;
const minigunnerSvg = `<rect x="8" y="12" width="24" height="16" rx="2" fill="#262626" stroke="#ffffff" stroke-width="2"/><circle cx="14" cy="20" r="2.5" fill="#ffffff"/><circle cx="20" cy="20" r="2.5" fill="#ffffff"/><circle cx="26" cy="20" r="2.5" fill="#ffffff"/>`;

// Ready-to-use black & white tower photos (names always in English)
export const TOWER_PHOTOS: PhotoAsset[] = [
  // 1. STARTER (8 towers)
  { id: 'scout', name: 'Scout', category: 'towers', rarity: 'Starter', tag: 'Starter', url: assetUrl('/assets/towers/Scout.png') },
  { id: 'sniper', name: 'Sniper', category: 'towers', rarity: 'Starter', tag: 'Cliff Single', url: assetUrl('/assets/towers/Sniper.png') },
  { id: 'soldier', name: 'Soldier', category: 'towers', rarity: 'Starter', tag: 'Burst Rifle', url: assetUrl('/assets/towers/Soldier.png') },
  { id: 'paintballer', name: 'Paintballer', category: 'towers', rarity: 'Starter', tag: 'Splash', url: assetUrl('/assets/towers/Paintballer.png') },
  { id: 'demoman', name: 'Demoman', category: 'towers', rarity: 'Starter', tag: 'Grenades', url: assetUrl('/assets/towers/Demoman.png') },
  { id: 'hunter', name: 'Hunter', category: 'towers', rarity: 'Starter', tag: 'Piercing', url: assetUrl('/assets/towers/Hunter.png') },
  { id: 'boomerang', name: 'Boomerang', category: 'towers', rarity: 'Starter', tag: 'Piercing Return', url: assetUrl('/assets/towers/Boomerang.png') },
  { id: 'slime-trooper', name: 'Slime Trooper', category: 'towers', rarity: 'Starter', tag: 'Corrosive Slime', url: assetUrl('/assets/towers/Slime Trooper.png') },

  // 2. INTERMEDIATE (14 towers)
  { id: 'militant', name: 'Militant', category: 'towers', rarity: 'Intermediate', tag: 'Assault DPS', url: assetUrl('/assets/towers/Militant.png') },
  { id: 'shotgunner', name: 'Shotgunner', category: 'towers', rarity: 'Intermediate', tag: 'Close Burst', url: assetUrl('/assets/towers/Shotgunner.png') },
  { id: 'rocketeer', name: 'Rocketeer', category: 'towers', rarity: 'Intermediate', tag: 'Rockets', url: assetUrl('/assets/towers/Rocketeer.png') },
  { id: 'pyromancer', name: 'Pyromancer', category: 'towers', rarity: 'Intermediate', tag: 'Flamethrower', url: assetUrl('/assets/towers/Pyromancer.png') },
  { id: 'crook-boss', name: 'Crook Boss', category: 'towers', rarity: 'Intermediate', tag: 'Spawns', url: assetUrl('/assets/towers/Crook Boss.png') },
  { id: 'military-base', name: 'Military Base', category: 'towers', rarity: 'Intermediate', tag: 'Vehicles', url: assetUrl('/assets/towers/Military Base.png') },
  { id: 'ace-pilot', name: 'Ace Pilot', category: 'towers', rarity: 'Intermediate', tag: 'Air Patrol', url: assetUrl('/assets/towers/Ace Pilot.png') },
  { id: 'farm', name: 'Farm', category: 'towers', rarity: 'Intermediate', tag: 'Income', url: assetUrl('/assets/towers/Farm.png') },
  { id: 'medic', name: 'Medic', category: 'towers', rarity: 'Intermediate', tag: 'Unstun', url: assetUrl('/assets/towers/Medic.png') },
  { id: 'freezer', name: 'Freezer', category: 'towers', rarity: 'Intermediate', tag: 'Freeze Beam', url: assetUrl('/assets/towers/Freezer.png') },
  { id: 'electroshocker', name: 'Electroshocker', category: 'towers', rarity: 'Intermediate', tag: 'Chain Stun', url: assetUrl('/assets/towers/Electroshocker.png') },
  { id: 'trapper', name: 'Trapper', category: 'towers', rarity: 'Intermediate', tag: 'Spike Traps', url: assetUrl('/assets/towers/Trapper.png') },
  { id: 'pulse-trooper', name: 'Pulse Trooper', category: 'towers', rarity: 'Intermediate', tag: 'Plasma Pulse', url: assetUrl('/assets/towers/Pulse Trooper.png') },
  { id: 'assassin', name: 'Assassin', category: 'towers', rarity: 'Intermediate', tag: 'Criticals', url: assetUrl('/assets/towers/Assassin.png') },

  // 3. ADVANCED (13 towers)
  { id: 'minigunner', name: 'Minigunner', category: 'towers', rarity: 'Advanced', tag: 'DPS', url: assetUrl('/assets/towers/Minigunner.png') },
  { id: 'ranger', name: 'Ranger', category: 'towers', rarity: 'Advanced', tag: 'Cliff DPS', url: assetUrl('/assets/towers/Ranger.png') },
  { id: 'commander', name: 'Commander', category: 'towers', rarity: 'Advanced', tag: 'Firerate Buff', url: assetUrl('/assets/towers/Commander.png') },
  { id: 'dj-booth', name: 'DJ Booth', category: 'towers', rarity: 'Advanced', tag: 'Discount', url: assetUrl('/assets/towers/DJ Booth.png') },
  { id: 'cowboy', name: 'Cowboy', category: 'towers', rarity: 'Advanced', tag: 'Cash & DPS', url: assetUrl('/assets/towers/Cowboy.png') },
  { id: 'warden', name: 'Warden', category: 'towers', rarity: 'Advanced', tag: 'Stun Melee', url: assetUrl('/assets/towers/Warden.png') },
  { id: 'turret', name: 'Turret', category: 'towers', rarity: 'Advanced', tag: 'Stationary DPS', url: assetUrl('/assets/towers/Turret.png') },
  { id: 'mortar', name: 'Mortar', category: 'towers', rarity: 'Advanced', tag: 'Artillery', url: assetUrl('/assets/towers/Mortar.png') },
  { id: 'pursuit', name: 'Pursuit', category: 'towers', rarity: 'Advanced', tag: 'Helicopter', url: assetUrl('/assets/towers/Pursuit.png') },
  { id: 'mercenary-base', name: 'Mercenary Base', category: 'towers', rarity: 'Advanced', tag: 'Mercenaries', url: assetUrl('/assets/towers/Mercenary Base.png') },
  { id: 'saboteur', name: 'Saboteur', category: 'towers', rarity: 'Advanced', tag: 'EMP Stun', url: assetUrl('/assets/towers/Saboteur.png') },
  { id: 'tesla', name: 'Tesla', category: 'towers', rarity: 'Advanced', tag: 'Chain Shock', url: assetUrl('/assets/towers/Tesla.png') },
  { id: 'gatling-gun', name: 'Gatling Gun', category: 'towers', rarity: 'Advanced', tag: 'Rotary Cannon', url: assetUrl('/assets/towers/Gatling Gun.png') },

  // 4. HARDCORE (5 towers)
  { id: 'accelerator', name: 'Accelerator', category: 'towers', rarity: 'Hardcore', tag: 'Laser DPS', url: assetUrl('/assets/towers/Accelerator.png') },
  { id: 'engineer', name: 'Engineer', category: 'towers', rarity: 'Hardcore', tag: 'Turrets', url: assetUrl('/assets/towers/Engineer.png') },
  { id: 'brawler', name: 'Brawler', category: 'towers', rarity: 'Hardcore', tag: 'Knockback', url: assetUrl('/assets/towers/Brawler.png') },
  { id: 'necromancer', name: 'Necromancer', category: 'towers', rarity: 'Hardcore', tag: 'Undead Spawns', url: assetUrl('/assets/towers/Necromancer.png') },
  { id: 'hacker', name: 'Hacker', category: 'towers', rarity: 'Hardcore', tag: 'Tech Buff', url: assetUrl('/assets/towers/Hacker.png') },

  // 5. EVOLVED (4 towers)
  { id: 'operator', name: 'Operator', category: 'towers', rarity: 'Evolved', tag: 'Combat Drones', url: assetUrl('/assets/towers/Operator.png') },
  { id: 'enforcer', name: 'Enforcer', category: 'towers', rarity: 'Evolved', tag: 'SWAT Backup', url: assetUrl('/assets/towers/Enforcer.png') },
  { id: 'kingpin', name: 'Kingpin', category: 'towers', rarity: 'Evolved', tag: 'Syndicate', url: assetUrl('/assets/towers/Kingpin.png') },
  { id: 'juggernaut', name: 'Juggernaut', category: 'towers', rarity: 'Evolved', tag: 'Heavy DPS', url: assetUrl('/assets/towers/Juggernaut.png') },

  // 6. GOLDEN PERKS (8 towers)
  { id: 'golden-scout', name: 'Golden Scout', category: 'towers', rarity: 'Golden Perks', tag: 'Early Game', url: assetUrl('/assets/towers/Golden Scout.png') },
  { id: 'golden-cowboy', name: 'Golden Cowboy', category: 'towers', rarity: 'Golden Perks', tag: 'Economy', url: assetUrl('/assets/towers/Golden Cowboy.png') },
  { id: 'golden-crook-boss', name: 'Golden Crook Boss', category: 'towers', rarity: 'Golden Perks', tag: 'Spawns', url: assetUrl('/assets/towers/Golden Crook Boss.png') },
  { id: 'golden-demoman', name: 'Golden Demoman', category: 'towers', rarity: 'Golden Perks', tag: 'Splash', url: assetUrl('/assets/towers/Golden Demoman.png') },
  { id: 'golden-minigunner', name: 'Golden Minigunner', category: 'towers', rarity: 'Golden Perks', tag: 'Heavy DPS', url: assetUrl('/assets/towers/Golden Minigunner.png') },
  { id: 'golden-pyromancer', name: 'Golden Pyromancer', category: 'towers', rarity: 'Golden Perks', tag: 'Defense Melt', url: assetUrl('/assets/towers/Golden Pyromancer.png') },
  { id: 'golden-soldier', name: 'Golden Soldier', category: 'towers', rarity: 'Golden Perks', tag: 'Burst', url: assetUrl('/assets/towers/Golden Soldier.png') },
  { id: 'golden-snowballer', name: 'Golden Snowballer', category: 'towers', rarity: 'Golden Perks', tag: 'Freeze', url: assetUrl('/assets/towers/Golden Snowballer.png') },

  // 7. EXCLUSIVE (22 towers)
  { id: 'gladiator', name: 'Gladiator', category: 'towers', rarity: 'Exclusive', tag: 'Sword Melee', url: assetUrl('/assets/towers/Gladiator.png') },
  { id: 'commando', name: 'Commando', category: 'towers', rarity: 'Exclusive', tag: 'Rockets & Rifle', url: assetUrl('/assets/towers/Commando.png') },
  { id: 'slasher', name: 'Slasher', category: 'towers', rarity: 'Exclusive', tag: 'Bleed Slash', url: assetUrl('/assets/towers/Slasher.png') },
  { id: 'frost-blaster', name: 'Frost Blaster', category: 'towers', rarity: 'Exclusive', tag: 'Frost Blast', url: assetUrl('/assets/towers/Frost Blaster.png') },
  { id: 'archer', name: 'Archer', category: 'towers', rarity: 'Exclusive', tag: 'Cliff Bow', url: assetUrl('/assets/towers/Archer.png') },
  { id: 'swarmer', name: 'Swarmer', category: 'towers', rarity: 'Exclusive', tag: 'Bee Swarms', url: assetUrl('/assets/towers/Swarmer.png') },
  { id: 'executioner', name: 'Executioner', category: 'towers', rarity: 'Exclusive', tag: 'Bouncing Axe', url: assetUrl('/assets/towers/Executioner.png') },
  { id: 'elf-camp', name: 'Elf Camp', category: 'towers', rarity: 'Exclusive', tag: 'Elf Spawns', url: assetUrl('/assets/towers/Elf Camp.png') },
  { id: 'harvester', name: 'Harvester', category: 'towers', rarity: 'Exclusive', tag: 'Thorns & Scythe', url: assetUrl('/assets/towers/Harvester.png') },
  { id: 'hallow-punk', name: 'Hallow Punk', category: 'towers', rarity: 'Exclusive', tag: 'Sonic Waves', url: assetUrl('/assets/towers/Hallow Punk.png') },
  { id: 'toxic-gunner', name: 'Toxic Gunner', category: 'towers', rarity: 'Exclusive', tag: 'Poison Slow', url: assetUrl('/assets/towers/Toxic Gunner.png') },
  { id: 'sledger', name: 'Sledger', category: 'towers', rarity: 'Exclusive', tag: 'Freeze Melee', url: assetUrl('/assets/towers/Sledger.png') },
  { id: 'cryomancer', name: 'Cryomancer', category: 'towers', rarity: 'Exclusive', tag: 'Cryo AoE', url: assetUrl('/assets/towers/Cryomancer.png') },
  { id: 'jester', name: 'Jester', category: 'towers', rarity: 'Exclusive', tag: 'Debuff', url: assetUrl('/assets/towers/Jester.png') },
  { id: 'spotlight', name: 'Spotlight', category: 'towers', rarity: 'Exclusive', tag: 'Hidden Detect', url: assetUrl('/assets/towers/Spotlight.png') },
  { id: 'firework-technician', name: 'Firework Technician', category: 'towers', rarity: 'Exclusive', tag: 'Fireworks', url: assetUrl('/assets/towers/Firework Technician.png') },
  { id: 'biologist', name: 'Biologist', category: 'towers', rarity: 'Exclusive', tag: 'Acid Puddles', url: assetUrl('/assets/towers/Biologist.png') },
  { id: 'elementalist', name: 'Elementalist', category: 'towers', rarity: 'Exclusive', tag: 'Spells', url: assetUrl('/assets/towers/Elementalist.png') },
  { id: 'snowballer', name: 'Snowballer', category: 'towers', rarity: 'Exclusive', tag: 'Snow Pellets', url: assetUrl('/assets/towers/Snowballer.png') },
  { id: 'warlock', name: 'Warlock', category: 'towers', rarity: 'Exclusive', tag: 'Dark Magic', url: assetUrl('/assets/towers/Warlock.png') },
  { id: 'mecha-base', name: 'Mecha Base', category: 'towers', rarity: 'Exclusive', tag: 'Mecha Vehicles', url: assetUrl('/assets/towers/Mecha Base.png') },
  { id: 'war-machine', name: 'War Machine', category: 'towers', rarity: 'Exclusive', tag: 'Titan DPS', url: assetUrl('/assets/towers/War Machine.png') }
];

export const MAP_PHOTOS: PhotoAsset[] = [
  // Real map images registered in public/assets/maps/ (see src/data/mapCatalog.ts)
  ...MAP_CATALOG.map((m): PhotoAsset => ({ id: `catalog-${m.id}`, name: m.name, category: 'maps', url: m.url }))
];

// Monochrome gamer avatar placeholders with barrier border
export const AVATAR_PHOTOS: PhotoAsset[] = [
  { id: 'av-1', name: 'Avatar 1', category: 'avatars', url: MONOCHROME_AVATAR_PLACEHOLDER },
  {
    id: 'av-2',
    name: 'Avatar 2',
    category: 'avatars',
    url: svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="16" fill="#050505" stroke="#404040" stroke-width="3"/>
      <rect x="6" y="6" width="88" height="88" rx="12" fill="#111111" stroke="#262626" stroke-width="1.5"/>
      <circle cx="50" cy="38" r="17" fill="#1f1f1f" stroke="#a3a3a3" stroke-width="2"/>
      <polygon points="50,12 40,26 60,26" fill="#ffffff"/>
      <rect x="24" y="65" width="52" height="24" rx="8" fill="#1f1f1f" stroke="#a3a3a3" stroke-width="2"/>
    </svg>`)
  },
  {
    id: 'av-3',
    name: 'Avatar 3',
    category: 'avatars',
    url: svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="16" fill="#050505" stroke="#404040" stroke-width="3"/>
      <rect x="6" y="6" width="88" height="88" rx="12" fill="#111111" stroke="#262626" stroke-width="1.5"/>
      <rect x="24" y="24" width="52" height="52" rx="10" fill="#1f1f1f" stroke="#a3a3a3" stroke-width="2"/>
      <path d="M 32 54 L 38 34 L 50 44 L 62 34 L 68 54 Z" fill="#ffffff"/>
    </svg>`)
  },
  {
    id: 'av-4',
    name: 'Avatar 4',
    category: 'avatars',
    url: svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="16" fill="#050505" stroke="#404040" stroke-width="3"/>
      <rect x="6" y="6" width="88" height="88" rx="12" fill="#111111" stroke="#262626" stroke-width="1.5"/>
      <polygon points="50,18 78,34 78,66 50,82 22,66 22,34" fill="#1f1f1f" stroke="#ffffff" stroke-width="2"/>
      <circle cx="50" cy="50" r="10" fill="#ffffff"/>
    </svg>`)
  }
];

export const BANNER_PHOTOS: PhotoAsset[] = [
  { id: 'ban-1', name: 'Header Cover', category: 'covers', url: MONOCHROME_BANNER_PLACEHOLDER }
];

export const STICKER_PHOTOS: PhotoAsset[] = [
  {
    id: 'stk-1',
    name: 'Badge Swords',
    category: 'stickers',
    url: svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="16" fill="#050505" stroke="#404040" stroke-width="2.5"/>
      <path d="M 22 22 L 58 58 M 22 58 L 58 22" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
      <circle cx="40" cy="40" r="12" fill="#141414" stroke="#ffffff" stroke-width="2"/>
    </svg>`)
  },
  {
    id: 'stk-2',
    name: 'Badge Shield',
    category: 'stickers',
    url: svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="16" fill="#050505" stroke="#404040" stroke-width="2.5"/>
      <path d="M 40 16 L 60 26 C 60 52 40 64 40 64 C 40 64 20 52 20 26 Z" fill="#171717" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="40" cy="38" r="6" fill="#ffffff"/>
    </svg>`)
  }
];

export const ALL_PHOTO_ASSETS: PhotoAsset[] = [
  ...TOWER_PHOTOS,
  ...MAP_PHOTOS,
  ...AVATAR_PHOTOS,
  ...BANNER_PHOTOS,
  ...STICKER_PHOTOS
];

/** True when the URL is one of the selectable map images (catalog maps and built-in placeholder maps). */
export const isMapAssetUrl = (url?: string): boolean =>
  !!url && (!!getMapByUrl(url) || MAP_PHOTOS.some(m => m.url === url));
