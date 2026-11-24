import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore.ts';
import { missionById } from '../game/missions.ts';
import { pressureAtm } from '../game/physics/submarine.ts';
import { scanState, sonar, clock, SONAR_COOLDOWN } from '../game/world.ts';
import { useTick } from '../hooks/useTick.ts';
import { SonarDisplay, nearestContact } from './SonarDisplay.tsx';
import { triggerPing } from '../hooks/useKeyboard.ts';

function Bar({ label, value, max, tone = 'cyan', hint }: { label: string; value: number; max: number; tone?: 'cyan' | 'teal' | 'amber' | 'rose'; hint?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const low = pct < 20;
  const color = low ? 'bg-danger-500' : { cyan: 'bg-tide-400', teal: 'bg-lagoon-400', amber: 'bg-warn-400', rose: 'bg-danger-500' }[tone];
  return (
    <div>
      <div className="mb-1 flex justify-between font-display text-xs text-tide-300"><span>{label}</span><span className="tabular-nums text-white">{hint ?? `${Math.round(pct)}%`}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-abyss-700" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-[width] duration-150 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DepthGauge({ depth, safe }: { depth: number; safe: number }) {
  const ratio = Math.min(1, depth / safe);
  return (
    <div className="glass flex w-24 flex-col items-center rounded-xl px-3 py-3" aria-label="Depth">
      <div className="font-display text-xs text-tide-300">Depth</div>
      <div className="font-display text-3xl font-semibold tabular-nums text-white">{depth.toFixed(0)}<span className="ml-0.5 text-sm text-tide-300">m</span></div>
      <div className="relative mt-2 h-28 w-3 overflow-hidden rounded-full bg-abyss-700">
        <div className={`absolute bottom-0 w-full rounded-full ${ratio > 1 ? 'bg-danger-500' : ratio > 0.85 ? 'bg-warn-400' : 'bg-tide-400'}`} style={{ height: `${Math.max(3, ratio * 100)}%`, top: 'auto' }} />
        <div className="absolute left-0 top-0 h-full w-full" style={{ background: 'repeating-linear-gradient(to bottom, transparent 0 13px, rgba(255,255,255,.18) 13px 14px)' }} />
      </div>
      <div className="mt-2 text-[11px] text-slate-400">Limit {safe.toFixed(0)} m</div>
      <div className="text-[11px] text-slate-400">{pressureAtm(depth).toFixed(1)} atm</div>
    </div>
  );
}

function ScanPrompt() {
  useTick(80);
  const toast = scanState.targetId;
  if (!toast) return null;
  const pct = Math.round(scanState.progress * 100);
  return (
    <div className="glass pointer-events-none absolute bottom-40 left-1/2 w-72 -translate-x-1/2 rounded-xl px-4 py-3 text-center">
      <div className="font-display text-sm text-white">{scanState.name}</div>
      <div className="text-xs text-tide-300">{Math.round(scanState.dist)} m away</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-abyss-700"><div className="h-full rounded-full bg-lagoon-400" style={{ width: `${pct}%` }} /></div>
      <div className="mt-1 text-xs text-slate-300">{scanState.scanning ? 'Scanning…' : 'Hold E to scan'}</div>
    </div>
  );
}

function Missions() {
  const missions = useGameStore((s) => s.missions);
  const tracked = useGameStore((s) => s.trackedMission);
  const list = missions.filter((m) => !m.done);
  const shown = list.find((m) => m.id === tracked) ?? list[0];
  if (!shown) return <div className="glass rounded-xl px-4 py-3 text-sm text-lagoon-400">All missions complete.</div>;
  const def = missionById(shown.id);
  return (
    <div className="glass w-64 rounded-xl px-4 py-3">
      <div className="font-display text-xs text-tide-300">{def.category} mission</div>
      <div className="font-display text-sm font-semibold text-white">{def.title}</div>
      <div className="mt-1 text-xs text-slate-300">{def.description}</div>
      <div className="mt-2 text-xs tabular-nums text-tide-300">{shown.progress} / {def.target} {def.unit}{def.spec.rule === 'depth_return' && shown.stage === 1 ? ' · now surface' : ''}</div>
    </div>
  );
}

export function HUD() {
  const hud = useGameStore((s) => s.hud);
  const stats = useGameStore((s) => s.stats);
  const lightsOn = useGameStore((s) => s.lightsOn);
  const cargoUsed = useGameStore((s) => s.cargoUsed)();
  const peers = useGameStore((s) => s.mp);
  const setPanel = useGameStore((s) => s.setPanel);
  useTick(250);

  const warnings: string[] = [];
  if (hud.overpressure) warnings.push('Hull is past its safe depth. Ascend now.');
  else if (hud.pressureWarning) warnings.push('Approaching the pressure limit.');
  if (hud.oxygen <= 0) warnings.push(`Emergency air: ${Math.ceil(hud.emergencyO2)} s. Surface now.`);
  else if (hud.oxygen < stats.oxygen * 0.2) warnings.push('Oxygen is low.');
  if (!hud.powered) warnings.push('Power lost. Emergency ballast is lifting the sub.');
  else if (hud.battery < stats.battery * 0.15) warnings.push('Battery is low.');
  if (hud.temp > 92) warnings.push('Engine overheating. Ease off the throttle.');
  if (hud.hull < stats.hull * 0.3) warnings.push('Hull integrity critical. Repair with X (1 copper).');
  const cooling = clock.t - sonar.pingStart < SONAR_COOLDOWN;
  const near = nearestContact();

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-sans">
      <div className="absolute left-4 top-4 flex flex-col gap-3">
        <div className="glass w-64 rounded-xl px-4 py-3">
          <div className="mb-2 font-display text-xs text-tide-300">{hud.zone}</div>
          <div className="flex flex-col gap-2.5">
            <Bar label="Oxygen" value={hud.oxygen} max={stats.oxygen} tone="teal" hint={`${Math.round(hud.oxygen / 60 * 10) / 10} min`} />
            <Bar label="Battery" value={hud.battery} max={stats.battery} />
            <Bar label="Hull" value={hud.hull} max={stats.hull} tone="amber" />
            <Bar label="Engine temp" value={hud.temp - 20} max={100} tone="amber" hint={`${Math.round(hud.temp)}°C`} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 text-xs text-slate-300">
            <span>Speed <b className="tabular-nums text-white">{hud.speed.toFixed(1)} m/s</b></span>
            <span>Cargo <b className="tabular-nums text-white">{cargoUsed.toFixed(0)}/{stats.cargo}</b></span>
            <span>X <b className="tabular-nums text-white">{hud.x.toFixed(0)}</b></span>
            <span>Z <b className="tabular-nums text-white">{hud.z.toFixed(0)}</b></span>
          </div>
        </div>
        <Missions />
      </div>

      <div className="absolute right-4 top-4 flex flex-col items-end gap-3">
        <div className="flex gap-3"><DepthGauge depth={hud.depth} safe={stats.maxDepth} />
          <div className="glass flex flex-col items-center rounded-xl p-2">
            <SonarDisplay />
            <div className="mt-1 text-[11px] text-slate-300">{near ? `${near.name} · ${Math.round(near.dist)} m` : 'No contacts. Press Q to ping.'}</div>
            <button className="btn pointer-events-auto mt-1.5 px-3 py-1 text-xs" disabled={cooling} onClick={() => triggerPing()}>{cooling ? 'Recharging…' : 'Ping (Q)'}</button>
          </div>
        </div>
        {peers.mp.status === 'online' && (<div className="glass rounded-xl px-3 py-2 text-xs text-slate-200">Room <b className="text-white">{peers.mp.room}</b> · {peers.mp.peers.length + 1} divers</div>)}
      </div>

      <div className="absolute left-1/2 top-4 flex w-[min(30rem,60vw)] -translate-x-1/2 flex-col gap-2">
        <AnimatePresence>
          {warnings.slice(0, 3).map((w) => (
            <motion.div key={w} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="rounded-lg border border-danger-500/60 bg-danger-500/20 px-4 py-2 text-center font-display text-sm text-white backdrop-blur">{w}</motion.div>
          ))}
        </AnimatePresence>
      </div>

      <ScanPrompt />

      <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2">
        {([['journal', 'Journal (J)'], ['inventory', 'Inventory (I)'], ['missions', 'Missions (K)'], ['workshop', 'Workshop (U)'], ['map', 'Map (M)']] as const).map(([p, l]) => (
          <button key={p} className="btn" onClick={() => setPanel(p)}>{l}</button>
        ))}
        <span className="glass rounded-md px-3 py-2 text-xs text-slate-300">Lights (F): <b className={lightsOn ? 'text-lagoon-400' : 'text-slate-400'}>{lightsOn ? 'on' : 'off'}</b></span>
      </div>
      <div className="absolute bottom-2 left-4 text-[11px] text-slate-400">W/S thrust · A/D turn · Space/C up/down · Q sonar · E scan · X repair · Esc pause</div>
    </div>
  );
}
