// Static game data: submarine classes, upgrades, items and zones. Pure data, no rendering imports.

export type SubClassId = 'explorer' | 'deep_diver' | 'research';
export type UpgradeId = 'engine' | 'oxygen' | 'sonar' | 'lights' | 'cargo' | 'hull';
export type ItemId = 'copper' | 'titanium' | 'rare_mineral' | 'sample' | 'artifact' | 'energy_crystal';
export type Cost = Partial<Record<ItemId, number>>;

export interface SubStats {
  maxSpeed: number; // m/s
  thrust: number; // m/s^2 at full throttle
  turnRate: number; // rad/s
  maxDepth: number; // safe depth, metres
  oxygen: number; // seconds of air at the surface
  battery: number; // energy units
  hull: number;
  cargo: number; // weight units
  sonarRange: number; // metres
  light: number; // headlight multiplier
}

export interface SubClass {
  id: SubClassId;
  name: string;
  description: string;
  base: SubStats;
}

export const SUB_CLASSES: Record<SubClassId, SubClass> = {
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Balanced speed and storage for reef surveys and general exploration.',
    base: { maxSpeed: 9, thrust: 6, turnRate: 1.15, maxDepth: 120, oxygen: 700, battery: 1500, hull: 100, cargo: 40, sonarRange: 140, light: 1 },
  },
  deep_diver: {
    id: 'deep_diver',
    name: 'Deep Diver',
    description: 'A thick pressure hull rated for extreme depth. Slower, with a smaller hold.',
    base: { maxSpeed: 7, thrust: 5, turnRate: 0.95, maxDepth: 300, oxygen: 600, battery: 1600, hull: 160, cargo: 25, sonarRange: 120, light: 1.35 },
  },
  research: {
    id: 'research',
    name: 'Research Submarine',
    description: 'Long-range sonar and long air supply for scientific work.',
    base: { maxSpeed: 8, thrust: 5.5, turnRate: 1.05, maxDepth: 160, oxygen: 900, battery: 1400, hull: 90, cargo: 30, sonarRange: 230, light: 1 },
  },
};

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  maxLevel: number;
  cost: (nextLevel: number) => Cost;
  apply: (s: SubStats, level: number) => void;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  engine: {
    id: 'engine', name: 'Engine tuning', description: '+12% top speed and thrust per level.', maxLevel: 3,
    cost: (l) => ({ copper: 4 * l, titanium: 2 * l }),
    apply: (s, l) => { s.maxSpeed *= 1 + 0.12 * l; s.thrust *= 1 + 0.12 * l; },
  },
  oxygen: {
    id: 'oxygen', name: 'Oxygen system', description: '+20% air supply per level.', maxLevel: 3,
    cost: (l) => ({ copper: 3 * l, sample: l }),
    apply: (s, l) => { s.oxygen *= 1 + 0.2 * l; },
  },
  sonar: {
    id: 'sonar', name: 'Sonar array', description: '+25% sonar range per level.', maxLevel: 3,
    cost: (l) => ({ titanium: 2 * l, energy_crystal: l }),
    apply: (s, l) => { s.sonarRange *= 1 + 0.25 * l; },
  },
  lights: {
    id: 'lights', name: 'Headlights', description: '+25% light output per level.', maxLevel: 3,
    cost: (l) => ({ copper: 2 * l, energy_crystal: l }),
    apply: (s, l) => { s.light *= 1 + 0.25 * l; },
  },
  cargo: {
    id: 'cargo', name: 'Cargo racks', description: '+10 cargo capacity per level.', maxLevel: 3,
    cost: (l) => ({ copper: 5 * l, titanium: l }),
    apply: (s, l) => { s.cargo += 10 * l; },
  },
  hull: {
    id: 'hull', name: 'Pressure hull', description: '+30 m safe depth and +20 hull per level.', maxLevel: 3,
    cost: (l) => ({ titanium: 3 * l, rare_mineral: l }),
    apply: (s, l) => { s.maxDepth += 30 * l; s.hull += 20 * l; },
  },
};

export function computeStats(cls: SubClassId, upgrades: Record<UpgradeId, number>): SubStats {
  const s: SubStats = { ...SUB_CLASSES[cls].base };
  (Object.keys(UPGRADES) as UpgradeId[]).forEach((id) => {
    const lvl = upgrades[id] ?? 0;
    if (lvl > 0) UPGRADES[id].apply(s, lvl);
  });
  return s;
}

export const EMPTY_UPGRADES: Record<UpgradeId, number> = { engine: 0, oxygen: 0, sonar: 0, lights: 0, cargo: 0, hull: 0 };

export interface ItemDef { id: ItemId; name: string; category: 'Metal' | 'Mineral' | 'Science' | 'Artifact' | 'Energy'; weight: number; description: string }

export const ITEMS: Record<ItemId, ItemDef> = {
  copper: { id: 'copper', name: 'Copper ore', category: 'Metal', weight: 1, description: 'Conductive metal for wiring, repairs and basic upgrades.' },
  titanium: { id: 'titanium', name: 'Titanium', category: 'Metal', weight: 1, description: 'Light, strong alloy used for engines and pressure hulls.' },
  rare_mineral: { id: 'rare_mineral', name: 'Rare mineral', category: 'Mineral', weight: 1, description: 'Dense crystalline ore needed for deep-rated hull plating.' },
  sample: { id: 'sample', name: 'Water sample', category: 'Science', weight: 0.5, description: 'Sealed sample for the research station. Used in oxygen systems.' },
  artifact: { id: 'artifact', name: 'Ancient artifact', category: 'Artifact', weight: 3, description: 'A carved object of unknown origin. Valuable to researchers.' },
  energy_crystal: { id: 'energy_crystal', name: 'Energy crystal', category: 'Energy', weight: 1, description: 'Humming crystal that stores charge. Used in sonar and lights.' },
};

export const HULL_COLORS = ['#f5b82e', '#e5e7eb', '#22d3ee', '#fb7185', '#a3e635', '#818cf8'];

export const WORLD_HALF = 300;
export const START_ZONE = 'reef';

export interface ZoneDef { id: string; name: string; playable: boolean; note: string }
export const ZONES: ZoneDef[] = [
  { id: 'reef', name: 'Tropical Coral Reef', playable: true, note: 'Playable in this build.' },
  { id: 'open_water', name: 'Open water', playable: true, note: 'The reef shelf drops away here.' },
  { id: 'abyssal_trench', name: 'Abyssal Trench rim', playable: true, note: 'Terrain and darkness only. Trench creatures are not built yet.' },
  { id: 'wrecks', name: 'Sunken Ship Graveyard', playable: false, note: 'Planned. One wreck exists inside the reef.' },
  { id: 'city', name: 'Lost Underwater City', playable: false, note: 'Planned.' },
  { id: 'arctic', name: 'Arctic Ocean', playable: false, note: 'Planned.' },
];
