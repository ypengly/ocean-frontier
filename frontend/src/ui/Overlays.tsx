import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore.ts';
import { audio } from '../audio/audioEngine.ts';
import { SettingsBody } from './Panels.tsx';

export function PauseOverlay() {
  const s = useGameStore();
  if (!s.paused || s.panel) return null;
  return (
    <motion.div className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-abyss-950/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="glass w-80 rounded-2xl p-6">
        <h2 className="mb-4 font-display text-xl font-semibold text-white">Paused</h2>
        <div className="flex flex-col gap-2">
          <button className="btn-primary" onClick={() => s.setPaused(false)}>Resume</button>
          <button className="btn" onClick={() => s.saveLocal()}>Save expedition</button>
          <button className="btn" onClick={() => { audio.stopAll(); s.toMenu(); }}>Save and exit to menu</button>
        </div>
        <div className="mt-5 border-t border-tide-500/20 pt-4"><SettingsBody /></div>
      </div>
    </motion.div>
  );
}

export function DeathScreen() {
  const s = useGameStore();
  return (
    <motion.div className="absolute inset-0 z-30 flex items-center justify-center bg-abyss-950/80 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="glass w-96 rounded-2xl p-7 text-center">
        <h2 className="font-display text-2xl font-semibold text-white">Expedition lost</h2>
        <p className="mt-2 text-sm text-slate-300">{s.failure}</p>
        <p className="mt-1 text-sm text-slate-400">The support vessel recovers you. You keep your discoveries, upgrades and artifacts but lose a quarter of your carried materials.</p>
        <div className="mt-5 flex flex-col gap-2">
          <button className="btn-primary" onClick={() => s.respawn()}>Return to the surface</button>
          <button className="btn" onClick={() => { audio.stopAll(); s.toMenu(); }}>Exit to menu</button>
        </div>
      </div>
    </motion.div>
  );
}
