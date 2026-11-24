import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore.ts';
import { input, sonar, subRuntime, clock, SONAR_COOLDOWN } from '../game/world.ts';
import { audio } from '../audio/audioEngine.ts';

const held = new Set<string>();

function recompute() {
  const up = held.has('KeyW') || held.has('ArrowUp');
  const down = held.has('KeyS') || held.has('ArrowDown');
  input.throttle = (up ? 1 : 0) - (down ? 1 : 0);
  input.turn = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
  input.vertical = (held.has('Space') ? 1 : 0) - (held.has('KeyC') || held.has('ShiftLeft') || held.has('ShiftRight') ? 1 : 0);
  input.scanHeld = held.has('KeyE');
}

export function clearInput() { held.clear(); recompute(); }

export function triggerPing(): boolean {
  const s = useGameStore.getState();
  if (s.screen !== 'playing' || s.paused) return false;
  if (clock.t - sonar.pingStart < SONAR_COOLDOWN) return false;
  if (s.vitals.battery < 6) { s.notify('Not enough power for a sonar ping.', 'warn'); return false; }
  s.vitals.battery -= 4;
  sonar.pingStart = clock.t;
  sonar.maxRange = s.stats.sonarRange;
  sonar.active = true;
  audio.ping();
  return true;
}

/** Global keyboard bindings. Mount once. */
export function useKeyboard() {
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const s = useGameStore.getState();
      if (e.code === 'Escape') {
        if (s.screen !== 'playing') return;
        if (s.panel) s.setPanel(null); else s.setPaused(!s.paused);
        clearInput();
        return;
      }
      if (s.screen !== 'playing') return;
      const panelKeys: Record<string, 'journal' | 'inventory' | 'missions' | 'workshop' | 'map'> = { KeyJ: 'journal', KeyI: 'inventory', KeyK: 'missions', KeyU: 'workshop', KeyM: 'map' };
      if (panelKeys[e.code]) { s.setPanel(s.panel === panelKeys[e.code] ? null : panelKeys[e.code]); clearInput(); return; }
      if (s.paused) return;
      if (e.code === 'KeyQ' && !e.repeat) { triggerPing(); return; }
      if (e.code === 'KeyF' && !e.repeat) { s.toggleLights(); audio.click(); return; }
      if (e.code === 'KeyX' && !e.repeat) { s.repair(); return; }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      held.add(e.code);
      recompute();
    };
    const onUp = (e: KeyboardEvent) => { held.delete(e.code); recompute(); };
    const onBlur = () => clearInput();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', onBlur); };
  }, []);
}

export { subRuntime };
