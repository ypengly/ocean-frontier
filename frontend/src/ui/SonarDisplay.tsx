import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore.ts';
import { CONTACT_MEMORY, clock, contacts, sonar, subRuntime, targets, type Vec3Like } from '../game/world.ts';

const SIZE = 168;
const tmp: Vec3Like = { x: 0, y: 0, z: 0 };

/** Circular sonar scope. Forward is up. Contacts persist for a while after a ping, then fade. */
export function SonarDisplay() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = SIZE * dpr; c.height = SIZE * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const id = setInterval(() => {
      const range = useGameStore.getState().stats.sonarRange;
      const r = SIZE / 2 - 4;
      g.clearRect(0, 0, SIZE, SIZE);
      g.save(); g.translate(SIZE / 2, SIZE / 2);
      g.strokeStyle = 'rgba(52,214,234,0.25)'; g.lineWidth = 1;
      [1, 0.66, 0.33].forEach((f) => { g.beginPath(); g.arc(0, 0, r * f, 0, Math.PI * 2); g.stroke(); });
      g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.moveTo(0, -r); g.lineTo(0, r); g.stroke();
      if (sonar.active) {
        g.strokeStyle = 'rgba(126,232,245,0.85)'; g.lineWidth = 2;
        g.beginPath(); g.arc(0, 0, Math.min(1, sonar.radius / range) * r, 0, Math.PI * 2); g.stroke();
      }
      const cy = Math.cos(subRuntime.yaw), sy = Math.sin(subRuntime.yaw);
      contacts.forEach((ct, id) => {
        const t = targets.get(id);
        if (!t) return;
        t.pos(tmp);
        const dx = tmp.x - subRuntime.x, dz = tmp.z - subRuntime.z;
        // Rotate into the sub's frame (forward = -z maps to screen up).
        const lx = dx * cy - dz * sy;
        const lz = dx * sy + dz * cy;
        const d = Math.hypot(lx, lz);
        if (d > range) return;
        const age = clock.t - ct.seenAt;
        const alpha = Math.max(0.15, 1 - age / CONTACT_MEMORY);
        const known = useGameStore.getState().journal.some((e) => e.id === id);
        g.fillStyle = t.kind === 'creature' ? `rgba(251,191,36,${alpha})` : t.category === 'Resource' ? `rgba(45,212,191,${alpha})` : `rgba(103,232,249,${alpha})`;
        g.beginPath(); g.arc((lx / range) * r, (lz / range) * r, t.kind === 'creature' ? 4 : 3, 0, Math.PI * 2); g.fill();
        if (!known && t.category !== 'Resource') { g.fillStyle = `rgba(255,255,255,${alpha})`; g.font = '9px sans-serif'; g.fillText('?', (lx / range) * r + 5, (lz / range) * r + 3); }
      });
      g.fillStyle = '#e0fbff';
      g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
      g.restore();
    }, 66);
    return () => clearInterval(id);
  }, []);

  return <canvas ref={ref} style={{ width: SIZE, height: SIZE }} aria-label="Sonar display" className="rounded-full" />;
}

export function nearestContact(): { name: string; dist: number } | null {
  let best: { name: string; dist: number } | null = null;
  contacts.forEach((_, id) => {
    const t = targets.get(id);
    if (!t) return;
    t.pos(tmp);
    const d = Math.hypot(tmp.x - subRuntime.x, tmp.y - subRuntime.y, tmp.z - subRuntime.z);
    if (!best || d < best.dist) best = { name: t.name, dist: d };
  });
  return best;
}
