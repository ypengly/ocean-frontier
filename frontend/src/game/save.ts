import { EMPTY_UPGRADES, type SubClassId, type UpgradeId } from './constants.ts';
import type { MissionState } from './missions.ts';

export interface JournalEntry { id: string; name: string; category: string; zone: string; depth: number; date: string; info: string; kind: 'creature' | 'poi' }

export interface SaveData {
  version: 1;
  subClass: SubClassId;
  hullColor: string;
  upgrades: Record<UpgradeId, number>;
  inventory: Record<string, number>;
  journal: JournalEntry[];
  collected: Record<string, true>;
  missions: MissionState[];
  maxDepth: number;
  savedAt: string;
}

export const SAVE_KEY = 'ocean-frontier-save-v1';

/** Defensive parse: anything malformed falls back to safe defaults instead of crashing the game. */
export function parseSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const classes: SubClassId[] = ['explorer', 'deep_diver', 'research'];
  const subClass = classes.includes(r.subClass as SubClassId) ? (r.subClass as SubClassId) : 'explorer';
  const upgrades = { ...EMPTY_UPGRADES };
  if (r.upgrades && typeof r.upgrades === 'object') {
    for (const k of Object.keys(upgrades) as UpgradeId[]) {
      const v = (r.upgrades as Record<string, unknown>)[k];
      if (typeof v === 'number' && v >= 0 && v <= 3) upgrades[k] = Math.floor(v);
    }
  }
  const inventory: Record<string, number> = {};
  if (r.inventory && typeof r.inventory === 'object') {
    for (const [k, v] of Object.entries(r.inventory as Record<string, unknown>)) if (typeof v === 'number' && v > 0 && v < 10000) inventory[k] = Math.floor(v);
  }
  return {
    version: 1,
    subClass,
    hullColor: typeof r.hullColor === 'string' ? r.hullColor : '#f5b82e',
    upgrades,
    inventory,
    journal: Array.isArray(r.journal) ? (r.journal as JournalEntry[]).filter((e) => e && typeof e.id === 'string') : [],
    collected: r.collected && typeof r.collected === 'object' ? (r.collected as Record<string, true>) : {},
    missions: Array.isArray(r.missions) ? (r.missions as MissionState[]) : [],
    maxDepth: typeof r.maxDepth === 'number' ? r.maxDepth : 0,
    savedAt: typeof r.savedAt === 'string' ? r.savedAt : new Date().toISOString(),
  };
}
