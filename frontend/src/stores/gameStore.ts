import { create } from 'zustand';
import { api } from '../api/client.ts';
import { EMPTY_UPGRADES, ITEMS, UPGRADES, computeStats, type ItemId, type SubClassId, type SubStats, type UpgradeId, type Cost } from '../game/constants.ts';
import { MISSIONS, applyEvent, initialMissions, missionById, type MissionEvent, type MissionState } from '../game/missions.ts';
import { SAVE_KEY, parseSave, type JournalEntry, type SaveData } from '../game/save.ts';
import { ZONE_LABEL, zoneAt } from '../game/terrainData.ts';
import { resetRuntime, subRuntime, type Target } from '../game/world.ts';
import { createVitals, type Vitals } from '../game/physics/submarine.ts';

export type Screen = 'menu' | 'playing' | 'dead';
export type Panel = null | 'journal' | 'inventory' | 'missions' | 'workshop' | 'map' | 'settings';
export type Quality = 'low' | 'medium' | 'high';
export interface Toast { id: number; text: string; tone: 'info' | 'good' | 'warn' | 'bad' }

export interface HudVitals {
  oxygen: number; emergencyO2: number; battery: number; hull: number; engine: number; temp: number;
  depth: number; speed: number; x: number; z: number; zone: string; maxDepth: number;
  overpressure: boolean; pressureWarning: boolean; powered: boolean;
}

interface GameState {
  screen: Screen;
  panel: Panel;
  paused: boolean;
  failure: string | null;

  subClass: SubClassId;
  hullColor: string;
  upgrades: Record<UpgradeId, number>;
  stats: SubStats;
  vitals: Vitals;
  hud: HudVitals;
  lightsOn: boolean;

  inventory: Record<string, number>;
  journal: JournalEntry[];
  collected: Record<string, true>;
  revealed: Record<string, true>;
  missions: MissionState[];
  trackedMission: string | null;

  quality: Quality;
  adaptive: boolean;
  volume: number;
  toasts: Toast[];

  auth: { token: string | null; username: string | null };
  expeditionId: string | null;
  mp: { room: string | null; status: 'off' | 'connecting' | 'online' | 'error'; peers: { id: string; name: string }[]; error: string | null };

  // actions
  newExpedition: () => void;
  loadSave: (data: SaveData) => void;
  buildSave: () => SaveData;
  saveLocal: () => void;
  hasLocalSave: () => boolean;
  startPlaying: () => void;
  toMenu: () => void;
  setPanel: (p: Panel) => void;
  setPaused: (p: boolean) => void;
  setHud: (h: HudVitals) => void;
  toggleLights: () => void;
  notify: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  cargoUsed: () => number;
  addItem: (item: ItemId, qty: number, force?: boolean) => boolean;
  completeScan: (t: Target) => void;
  reveal: (id: string) => void;
  emitMission: (ev: MissionEvent) => void;
  selectSub: (c: SubClassId) => void;
  setHullColor: (c: string) => void;
  canAfford: (cost: Cost) => boolean;
  buyUpgrade: (id: UpgradeId) => boolean;
  repair: () => void;
  fail: (reason: string) => void;
  respawn: () => void;
  setQuality: (q: Quality) => void;
  setAdaptive: (a: boolean) => void;
  setVolume: (v: number) => void;
  setAuth: (token: string | null, username: string | null) => void;
  setMp: (m: Partial<GameState['mp']>) => void;
  trackMission: (id: string | null) => void;
}

let toastId = 1;

const emptyHud = (s: SubStats): HudVitals => ({ oxygen: s.oxygen, emergencyO2: 60, battery: s.battery, hull: s.hull, engine: 100, temp: 20, depth: 12, speed: 0, x: 0, z: 60, zone: ZONE_LABEL.reef, maxDepth: 0, overpressure: false, pressureWarning: false, powered: true });

const savedAuth = (() => {
  try { const raw = localStorage.getItem('ocean-frontier-auth'); return raw ? JSON.parse(raw) as { token: string; username: string } : null; } catch { return null; }
})();

const baseStats = computeStats('explorer', EMPTY_UPGRADES);

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'menu', panel: null, paused: false, failure: null,
  subClass: 'explorer', hullColor: '#f5b82e', upgrades: { ...EMPTY_UPGRADES }, stats: baseStats,
  vitals: createVitals(baseStats), hud: emptyHud(baseStats), lightsOn: true,
  inventory: {}, journal: [], collected: {}, revealed: {}, missions: initialMissions(), trackedMission: 'sci_species',
  quality: 'medium', adaptive: true, volume: 0.6, toasts: [],
  auth: { token: savedAuth?.token ?? null, username: savedAuth?.username ?? null },
  expeditionId: null,
  mp: { room: null, status: 'off', peers: [], error: null },

  newExpedition: () => {
    const stats = computeStats(get().subClass, EMPTY_UPGRADES);
    resetRuntime();
    set({ upgrades: { ...EMPTY_UPGRADES }, stats, vitals: createVitals(stats), hud: emptyHud(stats), inventory: {}, journal: [], collected: {}, revealed: {}, missions: initialMissions(), failure: null, panel: null, paused: false, lightsOn: true });
  },

  loadSave: (d) => {
    const stats = computeStats(d.subClass, d.upgrades);
    const missions = initialMissions().map((m) => d.missions.find((x) => x.id === m.id) ?? m);
    resetRuntime();
    set({ subClass: d.subClass, hullColor: d.hullColor, upgrades: d.upgrades, stats, vitals: { ...createVitals(stats), maxDepthReached: d.maxDepth }, hud: emptyHud(stats), inventory: d.inventory, journal: d.journal, collected: d.collected, missions, revealed: {}, failure: null, panel: null, paused: false });
  },

  buildSave: () => {
    const s = get();
    return { version: 1, subClass: s.subClass, hullColor: s.hullColor, upgrades: s.upgrades, inventory: s.inventory, journal: s.journal, collected: s.collected, missions: s.missions, maxDepth: s.vitals.maxDepthReached, savedAt: new Date().toISOString() };
  },

  saveLocal: () => {
    const data = get().buildSave();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
    const { token } = get().auth;
    if (token) api.putSave(token, data).catch(() => { /* offline: the local save still exists */ });
  },

  hasLocalSave: () => {
    try { return parseSave(JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null')) !== null; } catch { return false; }
  },

  startPlaying: () => {
    set({ screen: 'playing', paused: false, panel: null });
    const { token } = get().auth;
    if (token) api.startExpedition(token, 'reef', get().subClass).then((r) => set({ expeditionId: r.expeditionId })).catch(() => set({ expeditionId: null }));
  },

  toMenu: () => { get().saveLocal(); set({ screen: 'menu', panel: null, paused: false }); },
  setPanel: (panel) => set({ panel, paused: panel !== null }),
  setPaused: (paused) => set({ paused }),
  setHud: (hud) => set({ hud }),
  toggleLights: () => { const on = !get().lightsOn; subRuntime.lightsOn = on; set({ lightsOn: on }); },

  notify: (text, tone = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => get().dismissToast(id), 5200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  cargoUsed: () => Object.entries(get().inventory).reduce((sum, [id, q]) => sum + (ITEMS[id as ItemId]?.weight ?? 1) * q, 0),

  addItem: (item, qty, force = false) => {
    const w = ITEMS[item].weight * qty;
    if (!force && get().cargoUsed() + w > get().stats.cargo + 1e-9) {
      get().notify('Cargo hold is full. Add cargo racks in the workshop (U).', 'warn');
      return false;
    }
    set((s) => ({ inventory: { ...s.inventory, [item]: (s.inventory[item] ?? 0) + qty } }));
    get().emitMission({ type: 'collect', item, qty });
    return true;
  },

  completeScan: (t) => {
    const s = get();
    if (t.kind === 'poi' && t.reward && t.category === 'Resource') {
      if (s.collected[t.id]) return;
      if (!s.addItem(t.reward.item as ItemId, t.reward.qty)) return;
      set((st) => ({ collected: { ...st.collected, [t.id]: true } }));
      s.notify(`Collected ${t.reward.qty} × ${ITEMS[t.reward.item as ItemId].name}`, 'good');
      return;
    }
    const first = !s.journal.some((e) => e.id === t.id);
    if (first) {
      const entry: JournalEntry = { id: t.id, name: t.name, category: t.category, zone: ZONE_LABEL[zoneAt(subRuntime.x, subRuntime.z)], depth: Math.round(-subRuntime.y), date: new Date().toISOString().slice(0, 10), info: t.info, kind: t.kind };
      set((st) => ({ journal: [...st.journal, entry] }));
      s.notify(`Discovered: ${t.name}`, 'good');
      const token = get().auth.token;
      const expeditionId = get().expeditionId;
      if (token) api.recordDiscovery(token, { expeditionId: expeditionId ?? undefined, targetId: t.id, name: t.name, category: t.category, zone: entry.zone, depth: entry.depth }).catch(() => undefined);
    } else {
      s.notify(`${t.name} rescanned`, 'info');
    }
    if (t.kind === 'poi' && t.reward && first && !s.collected[t.id]) {
      s.addItem(t.reward.item as ItemId, t.reward.qty, true);
      set((st) => ({ collected: { ...st.collected, [t.id]: true } }));
    }
    s.emitMission({ type: 'scan', kind: t.kind, targetId: t.id, firstTime: first });
  },

  reveal: (id) => { if (!get().revealed[id]) set((s) => ({ revealed: { ...s.revealed, [id]: true } })); },

  emitMission: (ev) => {
    const before = get().missions;
    const next = before.map((m) => applyEvent(missionById(m.id), m, ev));
    if (next.every((m, i) => m === before[i])) return;
    set({ missions: next });
    next.forEach((m, i) => {
      if (m.done && !before[i].done) {
        const def = missionById(m.id);
        Object.entries(def.reward).forEach(([item, qty]) => get().addItem(item as ItemId, qty as number, true));
        get().notify(`Mission complete: ${def.title}`, 'good');
      }
    });
  },

  selectSub: (subClass) => {
    const stats = computeStats(subClass, get().upgrades);
    set({ subClass, stats, vitals: createVitals(stats), hud: emptyHud(stats) });
  },
  setHullColor: (hullColor) => set({ hullColor }),

  canAfford: (cost) => Object.entries(cost).every(([i, q]) => (get().inventory[i] ?? 0) >= (q as number)),

  buyUpgrade: (id) => {
    const s = get();
    const lvl = s.upgrades[id];
    const def = UPGRADES[id];
    if (lvl >= def.maxLevel) return false;
    const cost = def.cost(lvl + 1);
    if (!s.canAfford(cost)) { s.notify('Not enough materials for that upgrade.', 'warn'); return false; }
    const inventory = { ...s.inventory };
    Object.entries(cost).forEach(([i, q]) => { inventory[i] = (inventory[i] ?? 0) - (q as number); if (inventory[i] <= 0) delete inventory[i]; });
    const upgrades = { ...s.upgrades, [id]: lvl + 1 };
    const stats = computeStats(s.subClass, upgrades);
    set({ inventory, upgrades, stats });
    s.notify(`${def.name} upgraded to level ${lvl + 1}`, 'good');
    return true;
  },

  repair: () => {
    const s = get();
    const v = s.vitals;
    const missing = s.stats.hull - v.hull;
    if (missing < 1 && v.engine > 99) { s.notify('No repairs needed.', 'info'); return; }
    if ((s.inventory.copper ?? 0) < 1) { s.notify('Repairs need copper ore.', 'warn'); return; }
    const inventory = { ...s.inventory, copper: s.inventory.copper - 1 };
    if (inventory.copper <= 0) delete inventory.copper;
    v.hull = Math.min(s.stats.hull, v.hull + 12);
    v.engine = Math.min(100, v.engine + 15);
    set({ inventory });
    s.notify('Repaired hull and engine (1 copper).', 'good');
  },

  fail: (failure) => { set({ screen: 'dead', failure, panel: null }); },

  respawn: () => {
    const s = get();
    const stats = s.stats;
    // Fair penalty: keep progress, lose a quarter of carried materials (artifacts are kept).
    const inventory: Record<string, number> = {};
    Object.entries(s.inventory).forEach(([k, q]) => { inventory[k] = k === 'artifact' ? q : Math.ceil(q * 0.75); });
    resetRuntime();
    set({ inventory, vitals: createVitals(stats), hud: emptyHud(stats), screen: 'playing', failure: null, paused: false });
    get().notify('Recovered by the support vessel. Some materials were lost.', 'warn');
  },

  setQuality: (quality) => set({ quality }),
  setAdaptive: (adaptive) => set({ adaptive }),
  setVolume: (volume) => set({ volume }),
  setAuth: (token, username) => {
    try { if (token && username) localStorage.setItem('ocean-frontier-auth', JSON.stringify({ token, username })); else localStorage.removeItem('ocean-frontier-auth'); } catch { /* ignore */ }
    set({ auth: { token, username } });
  },
  setMp: (m) => set((s) => ({ mp: { ...s.mp, ...m } })),
  trackMission: (trackedMission) => set({ trackedMission }),
}));

export const MISSION_COUNT = MISSIONS.length;
