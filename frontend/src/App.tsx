import { Component, type ReactNode } from 'react';
import { useGameStore } from './stores/gameStore.ts';
import { Scene } from './game/Scene.tsx';
import { HUD } from './ui/HUD.tsx';
import { MainMenu } from './ui/MainMenu.tsx';
import { Panels } from './ui/Panels.tsx';
import { Toasts } from './ui/Toasts.tsx';
import { DeathScreen, PauseOverlay } from './ui/Overlays.tsx';
import { useKeyboard } from './hooks/useKeyboard.ts';
import { useMultiplayer } from './hooks/useMultiplayer.ts';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (<div className="flex h-full items-center justify-center p-6"><div className="glass max-w-md rounded-2xl p-6"><h1 className="font-display text-xl text-white">The renderer stopped</h1><p className="mt-2 text-sm text-slate-300">{this.state.error}</p><p className="mt-2 text-sm text-slate-400">WebGL may be unavailable. Try a recent desktop browser with hardware acceleration enabled.</p><button className="btn mt-4" onClick={() => location.reload()}>Reload</button></div></div>);
    return this.props.children;
  }
}

export default function App() {
  useKeyboard();
  useMultiplayer();
  const screen = useGameStore((s) => s.screen);
  return (
    <ErrorBoundary>
      <div className="relative h-full w-full overflow-hidden">
        <Scene />
        {screen === 'menu' && <MainMenu />}
        {screen !== 'menu' && <HUD />}
        {screen === 'playing' && <PauseOverlay />}
        {screen === 'playing' && <Panels />}
        {screen === 'dead' && <DeathScreen />}
        <Toasts />
      </div>
    </ErrorBoundary>
  );
}
