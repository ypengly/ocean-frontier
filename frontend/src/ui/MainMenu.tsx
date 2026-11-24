import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '../api/client.ts';
import { useGameStore } from '../stores/gameStore.ts';
import { SAVE_KEY, parseSave } from '../game/save.ts';
import { audio } from '../audio/audioEngine.ts';
import { JournalBody, Modal, SettingsBody, WorkshopBody } from './Panels.tsx';

type View = 'main' | 'sub' | 'database' | 'settings' | 'multiplayer';

function MultiplayerBody({ onClose }: { onClose: () => void }) {
  const s = useGameStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [room, setRoom] = useState(s.mp.room ?? 'reef-crew');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = mode === 'login' ? await api.login(user, pass) : await api.register(user, pass);
      s.setAuth(r.token, r.username);
      setPass('');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      {s.auth.token ? (
        <div className="flex items-center justify-between rounded-lg border border-tide-500/20 bg-abyss-900/60 p-3">
          <span className="text-sm text-slate-200">Signed in as <b className="text-white">{s.auth.username}</b>. Progress is also saved to the server.</span>
          <button className="btn" onClick={() => { s.setAuth(null, null); s.setMp({ room: null }); }}>Sign out</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2"><button className={`btn ${mode === 'login' ? '!bg-tide-500/40 !text-white' : ''}`} onClick={() => setMode('login')}>Sign in</button><button className={`btn ${mode === 'register' ? '!bg-tide-500/40 !text-white' : ''}`} onClick={() => setMode('register')}>Create account</button></div>
          <input className="input" placeholder="Username (3-24 letters, digits, _)" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
          <input className="input" type="password" placeholder="Password (8+ characters)" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} />
          <button className="btn-primary" disabled={busy || user.length < 3 || pass.length < 8} onClick={() => void submit()}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          {error && <p role="alert" className="text-sm text-danger-500">{error}</p>}
          <p className="text-xs text-slate-400">Accounts need the backend running. Single-player works without one.</p>
        </div>
      )}
      <div className="flex flex-col gap-2 border-t border-tide-500/20 pt-4">
        <label htmlFor="room" className="font-display text-sm text-tide-300">Expedition room</label>
        <input id="room" className="input" value={room} onChange={(e) => setRoom(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24))} placeholder="Room code (3-24 characters)" />
        <button className="btn-primary" disabled={!s.auth.token || room.length < 3} onClick={() => { s.setMp({ room }); onClose(); }}>Join this room when the expedition starts</button>
        <p className="text-xs text-slate-400">Friends who use the same room code see each other's submarines and share discoveries. Up to 8 divers per room.</p>
        {s.mp.room && <p className="text-xs text-lagoon-400">Room set: {s.mp.room}. <button className="underline" onClick={() => s.setMp({ room: null })}>Clear</button></p>}
      </div>
    </div>
  );
}

export function MainMenu() {
  const s = useGameStore();
  const [view, setView] = useState<View>('main');
  const [loading, setLoading] = useState(false);
  const canContinue = s.hasLocalSave() || !!s.auth.token;

  const start = () => { audio.init(); s.startPlaying(); };

  const continueGame = async () => {
    audio.init(); setLoading(true);
    let data = null;
    if (s.auth.token) {
      try { data = parseSave((await api.getSave(s.auth.token)).data); } catch { /* fall back to the local save */ }
    }
    if (!data) { try { data = parseSave(JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null')); } catch { data = null; } }
    setLoading(false);
    if (!data) { s.notify('No saved expedition found.', 'warn'); return; }
    s.loadSave(data);
    s.startPlaying();
  };

  const items: [string, () => void, boolean][] = [
    ['Continue expedition', () => void continueGame(), !canContinue || loading],
    ['New expedition', () => { s.newExpedition(); start(); }, false],
    ['Submarine selection', () => setView('sub'), false],
    ['Exploration database', () => setView('database'), false],
    ['Multiplayer', () => setView('multiplayer'), false],
    ['Settings', () => setView('settings'), false],
  ];

  return (
    <div className="absolute inset-0 flex items-center">
      <div className="absolute inset-0 bg-gradient-to-r from-abyss-950/85 via-abyss-950/35 to-transparent" />
      <motion.div className="relative ml-[7vw] w-[min(26rem,86vw)]" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
        <div className="font-display text-sm text-tide-300">Deep research programme</div>
        <h1 className="font-display text-5xl font-bold leading-tight text-white">Ocean Frontier</h1>
        <div className="mb-8 font-display text-xl text-lagoon-400">The Lost Abyss</div>
        <div className="flex flex-col gap-2.5">
          {items.map(([label, fn, disabled]) => (<button key={label} className="glass rounded-lg px-5 py-3 text-left font-display text-base text-white transition-colors hover:bg-tide-500/25 disabled:opacity-40" onClick={fn} disabled={disabled}>{label}</button>))}
        </div>
        <p className="mt-6 text-xs text-slate-400">Reef survey build. Continue loads your latest saved expedition.</p>
      </motion.div>
      <AnimatePresence>
        {view === 'sub' && <Modal key="sub" title="Submarine selection" onClose={() => setView('main')} wide><WorkshopBody allowClassChange /></Modal>}
        {view === 'database' && <Modal key="db" title="Exploration database" onClose={() => setView('main')} wide><JournalBody /></Modal>}
        {view === 'settings' && <Modal key="set" title="Settings" onClose={() => setView('main')}><SettingsBody /></Modal>}
        {view === 'multiplayer' && <Modal key="mp" title="Multiplayer" onClose={() => setView('main')}><MultiplayerBody onClose={() => setView('main')} /></Modal>}
      </AnimatePresence>
    </div>
  );
}
