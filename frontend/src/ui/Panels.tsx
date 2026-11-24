import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore.ts';
import { HULL_COLORS, ITEMS, SUB_CLASSES, UPGRADES, computeStats, type ItemId, type SubClassId, type UpgradeId } from '../game/constants.ts';
import { MISSIONS } from '../game/missions.ts';
import { SPECIES } from '../game/species.ts';
import { POIS } from '../game/pois.ts';
import { heightAt } from '../game/terrainData.ts';
import { WORLD_HALF } from '../game/constants.ts';
import { remotes, subRuntime } from '../game/world.ts';
import { smoothstep } from '../game/noise.ts';
import { api } from '../api/client.ts';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <motion.div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-abyss-950/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div role="dialog" aria-label={title} className={`glass scroll-thin max-h-[86vh] w-full overflow-y-auto rounded-2xl p-6 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold text-white">{title}</h2><button className="btn px-3 py-1" onClick={onClose} aria-label="Close">Close (Esc)</button></div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) {
  return (<div className="mb-4 flex gap-2">{tabs.map(([id, label]) => (<button key={id} onClick={() => onChange(id)} className={`rounded-md px-3 py-1.5 font-display text-sm ${value === id ? 'bg-tide-500/30 text-white' : 'text-tide-300 hover:bg-abyss-800'}`}>{label}</button>))}</div>);
}

export function JournalBody() {
  const journal = useGameStore((s) => s.journal);
  const [tab, setTab] = useState<'discoveries' | 'species'>('discoveries');
  const [synced, setSynced] = useState<number | null>(null);
  useEffect(() => { api.species().then((r) => setSynced(r.length)).catch(() => setSynced(null)); }, []);
  return (
    <>
      <Tabs tabs={[['discoveries', `Discoveries (${journal.length})`], ['species', 'Creature encyclopedia']]} value={tab} onChange={setTab} />
      {tab === 'discoveries' && (journal.length === 0
        ? <p className="text-sm text-slate-300">Nothing recorded yet. Get close to a creature or site and hold E to scan it.</p>
        : <ul className="flex flex-col gap-3">{[...journal].reverse().map((e) => (
          <li key={e.id} className="rounded-lg border border-tide-500/20 bg-abyss-900/60 p-3">
            <div className="flex items-baseline justify-between"><span className="font-display font-semibold text-white">{e.name}</span><span className="text-xs text-lagoon-400">Scan complete</span></div>
            <div className="text-xs text-tide-300">{e.category} · {e.zone} · {e.depth} m · {e.date}</div>
            <p className="mt-1.5 text-sm text-slate-300">{e.info}</p>
          </li>))}</ul>)}
      {tab === 'species' && (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">{SPECIES.map((sp) => { const done = journal.some((e) => e.id === sp.id); return (
            <li key={sp.id} className="rounded-lg border border-tide-500/20 bg-abyss-900/60 p-3">
              <div className="font-display font-semibold text-white">{done ? sp.name : 'Unknown species'}</div>
              <div className="text-xs text-tide-300">{done ? `${sp.latin} · ${sp.category} · ${sp.size}` : `${sp.category} · ${sp.size}`}</div>
              <p className="mt-1.5 text-sm text-slate-300">{done ? sp.info : 'Scan this creature to unlock its entry.'}</p>
            </li>); })}</ul>
          <p className="mt-3 text-xs text-slate-400">{synced === null ? 'Server catalogue unavailable. Showing the built-in encyclopedia.' : `Server catalogue online (${synced} species).`}</p>
        </>
      )}
    </>
  );
}

function InventoryBody() {
  const inv = useGameStore((s) => s.inventory);
  const used = useGameStore((s) => s.cargoUsed)();
  const cap = useGameStore((s) => s.stats.cargo);
  const entries = Object.entries(inv).filter(([, q]) => q > 0);
  return (
    <>
      <div className="mb-1 flex justify-between text-sm"><span className="text-tide-300">Storage</span><span className="tabular-nums text-white">{used.toFixed(1)} / {cap}</span></div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-abyss-700"><div className="h-full rounded-full bg-tide-400" style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} /></div>
      {entries.length === 0 ? <p className="text-sm text-slate-300">The hold is empty. Collect ore, samples and artifacts from the seabed.</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">{entries.map(([id, q]) => { const it = ITEMS[id as ItemId]; if (!it) return null; return (
          <li key={id} className="rounded-lg border border-tide-500/20 bg-abyss-900/60 p-3">
            <div className="flex justify-between"><span className="font-display font-semibold text-white">{it.name}</span><span className="tabular-nums text-tide-300">×{q}</span></div>
            <div className="text-xs text-lagoon-400">{it.category} · weight {it.weight}</div>
            <p className="mt-1 text-sm text-slate-300">{it.description}</p>
          </li>); })}</ul>)}
    </>
  );
}

function MissionsBody() {
  const missions = useGameStore((s) => s.missions);
  const tracked = useGameStore((s) => s.trackedMission);
  const track = useGameStore((s) => s.trackMission);
  return (
    <ul className="flex flex-col gap-3">{MISSIONS.map((def) => { const m = missions.find((x) => x.id === def.id)!; return (
      <li key={def.id} className="rounded-lg border border-tide-500/20 bg-abyss-900/60 p-3">
        <div className="flex items-baseline justify-between"><span className="font-display font-semibold text-white">{def.title}</span><span className="text-xs text-tide-300">{def.category}</span></div>
        <p className="mt-1 text-sm text-slate-300">{def.description}</p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="tabular-nums text-tide-300">{m.done ? 'Complete' : `${m.progress} / ${def.target} ${def.unit}`}</span>
          <span className="text-slate-400">Reward: {Object.entries(def.reward).map(([i, q]) => `${q} ${ITEMS[i as ItemId].name}`).join(', ')}</span>
          {!m.done && <button className="btn px-2 py-1 text-xs" disabled={tracked === def.id} onClick={() => track(def.id)}>{tracked === def.id ? 'Tracking' : 'Track'}</button>}
        </div>
      </li>); })}</ul>
  );
}

export function WorkshopBody({ allowClassChange }: { allowClassChange: boolean }) {
  const s = useGameStore();
  return (
    <>
      <h3 className="mb-2 font-display text-sm text-tide-300">Submarine</h3>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {(Object.keys(SUB_CLASSES) as SubClassId[]).map((id) => { const c = SUB_CLASSES[id]; const st = computeStats(id, s.upgrades); const active = s.subClass === id; return (
          <button key={id} disabled={!allowClassChange} onClick={() => s.selectSub(id)} className={`rounded-lg border p-3 text-left transition-colors ${active ? 'border-tide-400 bg-tide-500/20' : 'border-tide-500/20 bg-abyss-900/60 hover:bg-abyss-800'} disabled:opacity-60`}>
            <div className="font-display font-semibold text-white">{c.name}</div>
            <p className="mt-1 text-xs text-slate-300">{c.description}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-2 text-[11px] text-tide-300"><span>Speed {st.maxSpeed.toFixed(1)}</span><span>Depth {st.maxDepth.toFixed(0)} m</span><span>Hull {st.hull.toFixed(0)}</span><span>Cargo {st.cargo}</span><span>Air {(st.oxygen / 60).toFixed(0)} min</span><span>Sonar {st.sonarRange.toFixed(0)} m</span></div>
          </button>); })}
      </div>
      {!allowClassChange && <p className="-mt-3 mb-4 text-xs text-slate-400">Change submarine class from the main menu.</p>}
      <h3 className="mb-2 font-display text-sm text-tide-300">Hull colour</h3>
      <div className="mb-5 flex gap-2">{HULL_COLORS.map((c) => (<button key={c} aria-label={`Hull colour ${c}`} onClick={() => s.setHullColor(c)} className={`h-8 w-8 rounded-full border-2 ${s.hullColor === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />))}</div>
      <h3 className="mb-2 font-display text-sm text-tide-300">Upgrades</h3>
      <ul className="flex flex-col gap-2">{(Object.keys(UPGRADES) as UpgradeId[]).map((id) => { const u = UPGRADES[id]; const lvl = s.upgrades[id]; const maxed = lvl >= u.maxLevel; const cost = maxed ? {} : u.cost(lvl + 1); const afford = !maxed && s.canAfford(cost); return (
        <li key={id} className="flex items-center justify-between gap-3 rounded-lg border border-tide-500/20 bg-abyss-900/60 p-3">
          <div><div className="font-display font-semibold text-white">{u.name} <span className="text-xs text-tide-300">level {lvl}/{u.maxLevel}</span></div><div className="text-xs text-slate-300">{u.description}</div>
            {!maxed && <div className="mt-1 text-xs text-slate-400">Cost: {Object.entries(cost).map(([i, q]) => { const have = s.inventory[i] ?? 0; return <span key={i} className={have >= (q as number) ? 'text-lagoon-400' : 'text-danger-500'}>{q} {ITEMS[i as ItemId].name} ({have})&nbsp; </span>; })}</div>}</div>
          <button className="btn-primary shrink-0" disabled={!afford} onClick={() => s.buyUpgrade(id)}>{maxed ? 'Maxed' : 'Upgrade'}</button>
        </li>); })}</ul>
    </>
  );
}

function MapBody() {
  const ref = useRef<HTMLCanvasElement>(null);
  const revealed = useGameStore((s) => s.revealed);
  const journal = useGameStore((s) => s.journal);
  const collected = useGameStore((s) => s.collected);
  useEffect(() => {
    const c = ref.current!;
    const N = 420;
    c.width = N; c.height = N;
    const g = c.getContext('2d')!;
    const img = g.createImageData(N, N);
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const x = (px / N - 0.5) * WORLD_HALF * 2, z = (py / N - 0.5) * WORLD_HALF * 2;
      const t = smoothstep(-5, -190, heightAt(x, z));
      const o = (py * N + px) * 4;
      img.data[o] = 30 - 26 * t; img.data[o + 1] = 150 - 130 * t; img.data[o + 2] = 190 - 130 * t; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const toPx = (x: number, z: number): [number, number] => [(x / (WORLD_HALF * 2) + 0.5) * N, (z / (WORLD_HALF * 2) + 0.5) * N];
    POIS.forEach((p) => {
      const known = journal.some((e) => e.id === p.id) || revealed[p.id] || (!p.hidden && p.category !== 'Resource');
      if (!known || collected[p.id]) return;
      const [x, z] = toPx(p.x, p.z);
      g.fillStyle = p.category === 'Resource' ? '#2dd4bf' : '#fde68a';
      g.beginPath(); g.arc(x, z, p.category === 'Resource' ? 3 : 5, 0, Math.PI * 2); g.fill();
      if (p.category !== 'Resource') { g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(p.name, x + 8, z + 4); }
    });
    remotes.forEach((r) => { const [x, z] = toPx(r.x, r.z); g.fillStyle = '#a78bfa'; g.beginPath(); g.arc(x, z, 4, 0, Math.PI * 2); g.fill(); });
    const [sx, sz] = toPx(subRuntime.x, subRuntime.z);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(sx, sz, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#22d3ee'; g.lineWidth = 2; g.stroke();
  }, [revealed, journal, collected]);
  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={ref} className="w-full max-w-md rounded-lg border border-tide-500/30" aria-label="World map" />
      <p className="text-xs text-slate-300">Lighter water is shallow reef; darker water drops toward the trench (south). White dot: you. Gold: sites. Teal: resources. Hidden sites appear after a sonar ping.</p>
    </div>
  );
}

export function SettingsBody() {
  const s = useGameStore();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 font-display text-sm text-tide-300">Graphics quality</div>
        <div className="flex gap-2">{(['low', 'medium', 'high'] as const).map((q) => (<button key={q} onClick={() => s.setQuality(q)} className={`btn ${s.quality === q ? '!bg-tide-500/40 !text-white' : ''}`}>{q[0].toUpperCase() + q.slice(1)}</button>))}</div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={s.adaptive} onChange={(e) => s.setAdaptive(e.target.checked)} />Lower quality automatically if the frame rate drops</label>
      </div>
      <div>
        <label className="mb-2 block font-display text-sm text-tide-300" htmlFor="vol">Volume</label>
        <input id="vol" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => { s.setVolume(Number(e.target.value)); import('../audio/audioEngine.ts').then((m) => m.audio.setVolume(Number(e.target.value))); }} className="w-full accent-cyan-400" />
      </div>
    </div>
  );
}

export function Panels() {
  const panel = useGameStore((s) => s.panel);
  const setPanel = useGameStore((s) => s.setPanel);
  const close = () => setPanel(null);
  return (
    <AnimatePresence>
      {panel === 'journal' && <Modal key="j" title="Discovery journal" onClose={close} wide><JournalBody /></Modal>}
      {panel === 'inventory' && <Modal key="i" title="Inventory" onClose={close}><InventoryBody /></Modal>}
      {panel === 'missions' && <Modal key="m" title="Mission dashboard" onClose={close}><MissionsBody /></Modal>}
      {panel === 'workshop' && <Modal key="w" title="Submarine workshop" onClose={close} wide><WorkshopBody allowClassChange={false} /></Modal>}
      {panel === 'map' && <Modal key="map" title="World map" onClose={close}><MapBody /></Modal>}
      {panel === 'settings' && <Modal key="s" title="Settings" onClose={close}><SettingsBody /></Modal>}
    </AnimatePresence>
  );
}
