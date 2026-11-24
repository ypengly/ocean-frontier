import type { Cost } from './constants.ts';

export type MissionCategory = 'Scientific' | 'Exploration' | 'Recovery' | 'Survival';

export type MissionRule =
  | { rule: 'scan_species' }
  | { rule: 'scan_target'; targetId: string }
  | { rule: 'collect'; item: 'sample' | 'copper' | 'titanium' | 'artifact' | 'energy_crystal' | 'rare_mineral' }
  | { rule: 'depth_return' };

export interface MissionDef {
  id: string;
  title: string;
  category: MissionCategory;
  description: string;
  target: number;
  unit: string;
  reward: Cost;
  spec: MissionRule;
}

export interface MissionState { id: string; progress: number; done: boolean; stage: number }

export type MissionEvent =
  | { type: 'scan'; kind: 'creature' | 'poi'; targetId: string; firstTime: boolean }
  | { type: 'collect'; item: string; qty: number }
  | { type: 'depth'; depth: number }
  | { type: 'surface' };

export const MISSIONS: MissionDef[] = [
  { id: 'sci_species', title: 'Catalogue the reef', category: 'Scientific', description: 'Scan 3 different species with the scanner (hold E close to a creature).', target: 3, unit: 'species', reward: { titanium: 2, copper: 4 }, spec: { rule: 'scan_species' } },
  { id: 'sci_samples', title: 'Water sampling', category: 'Scientific', description: 'Collect 3 water samples from the glowing sample sites.', target: 3, unit: 'samples', reward: { energy_crystal: 1, copper: 3 }, spec: { rule: 'collect', item: 'sample' } },
  { id: 'exp_cave', title: 'Hidden cave', category: 'Exploration', description: 'Ping with sonar (Q) to find the hidden cave on the reef wall, then scan it.', target: 1, unit: 'cave', reward: { rare_mineral: 1, titanium: 2 }, spec: { rule: 'scan_target', targetId: 'reef_cave' } },
  { id: 'exp_pillar', title: 'Find the ancient pillar', category: 'Exploration', description: 'Locate and scan the carved pillar on the open-water shelf, roughly 100 m down. Check your depth limit first.', target: 1, unit: 'site', reward: { artifact: 1, energy_crystal: 1 }, spec: { rule: 'scan_target', targetId: 'ancient_pillar' } },
  { id: 'rec_cargo', title: 'Recover lost cargo', category: 'Recovery', description: 'Recover the cargo chest from the wreck.', target: 1, unit: 'chest', reward: { titanium: 3, copper: 5 }, spec: { rule: 'scan_target', targetId: 'wreck_chest' } },
  { id: 'sur_depth', title: 'Dive and return', category: 'Survival', description: 'Dive to 70 m, then surface again before your air runs out.', target: 70, unit: 'm', reward: { rare_mineral: 2, energy_crystal: 1 }, spec: { rule: 'depth_return' } },
];

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id)!;

export function initialMissions(): MissionState[] {
  return MISSIONS.map((m) => ({ id: m.id, progress: 0, done: false, stage: 0 }));
}

/** Returns the updated state, or the same object when the event is irrelevant. */
export function applyEvent(def: MissionDef, st: MissionState, ev: MissionEvent): MissionState {
  if (st.done) return st;
  const next = { ...st };
  switch (def.spec.rule) {
    case 'scan_species':
      if (ev.type === 'scan' && ev.kind === 'creature' && ev.firstTime) next.progress = Math.min(def.target, st.progress + 1);
      break;
    case 'scan_target':
      if (ev.type === 'scan' && ev.targetId === def.spec.targetId) next.progress = 1;
      break;
    case 'collect':
      if (ev.type === 'collect' && ev.item === def.spec.item) next.progress = Math.min(def.target, st.progress + ev.qty);
      break;
    case 'depth_return':
      if (ev.type === 'depth' && st.stage === 0) {
        next.progress = Math.max(st.progress, Math.min(def.target, Math.floor(ev.depth)));
        if (ev.depth >= def.target) next.stage = 1;
      } else if (ev.type === 'surface' && st.stage === 1) {
        next.done = true;
      }
      break;
  }
  if (def.spec.rule !== 'depth_return' && next.progress >= def.target) next.done = true;
  return next.progress === st.progress && next.stage === st.stage && next.done === st.done ? st : next;
}
