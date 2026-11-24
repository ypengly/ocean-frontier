import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore.ts';
import { clamp } from '../noise.ts';
import { subRuntime } from '../world.ts';
import { heightAt } from '../terrainData.ts';
import { speciesById } from '../species.ts';
import { useTarget } from './useTarget.ts';

const ROUTES = [
  { cx: -30, cz: 30, r: 28, w: 0.06, a: 0 },
  { cx: 50, cz: -10, r: 22, w: -0.07, a: 2 },
  { cx: -10, cz: -60, r: 32, w: 0.05, a: 4 },
];

/** Sea turtles that cruise loops around the reef and flap their flippers. */
export function Turtles() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const flippers = useRef<(THREE.Mesh | null)[][]>([[], [], []]);
  const state = useMemo(() => ROUTES.map((r) => ({ ...r, x: r.cx + r.r, y: -12, z: r.cz })), []);
  const sp = speciesById('sea_turtle')!;
  const target = useMemo(() => ({
    id: sp.id, name: sp.name, kind: 'creature' as const, category: sp.category, info: `${sp.info} (${sp.latin})`, scanTime: sp.scanTime, range: 22,
    pos: (o: { x: number; y: number; z: number }) => {
      let best = state[0], bd = Infinity;
      for (const t of state) { const d = Math.hypot(t.x - subRuntime.x, t.z - subRuntime.z); if (d < bd) { bd = d; best = t; } }
      o.x = best.x; o.y = best.y; o.z = best.z;
    },
  }), [sp, state]);
  useTarget(target);

  useFrame((fs, delta) => {
    const s = useGameStore.getState();
    const paused = s.screen === 'playing' && s.paused;
    const t = fs.clock.elapsedTime;
    state.forEach((r, i) => {
      if (!paused) {
        const nearSub = Math.hypot(r.x - subRuntime.x, r.z - subRuntime.z) < 12 && subRuntime.speed > 1;
        r.a += r.w * Math.min(delta, 0.05) * (nearSub ? 2 : 1);
        r.x = r.cx + Math.cos(r.a) * r.r;
        r.z = r.cz + Math.sin(r.a) * r.r;
        r.y = clamp(heightAt(r.x, r.z) + 4.5, -30, -6) + Math.sin(t * 0.5 + i) * 0.6;
      }
      const g = groups.current[i];
      if (!g) return;
      const dx = -Math.sin(r.a) * Math.sign(r.w), dz = Math.cos(r.a) * Math.sign(r.w);
      g.position.set(r.x, r.y, r.z);
      g.rotation.set(0, Math.atan2(-dx, -dz), Math.sin(t * 1.2 + i) * 0.08, 'YXZ');
      flippers.current[i].forEach((f, k) => { if (f) f.rotation.z = (k % 2 ? 1 : -1) * (0.35 + Math.sin(t * 2 + i) * 0.45); });
    });
  });

  return (
    <>
      {state.map((_, i) => (
        <group key={i} ref={(el) => { groups.current[i] = el; }} scale={1.1}>
          <mesh scale={[1, 0.45, 1.3]}><sphereGeometry args={[0.8, 14, 10]} /><meshStandardMaterial color="#6b7f3a" roughness={0.7} /></mesh>
          <mesh position={[0, -0.12, 0]} scale={[0.9, 0.3, 1.2]}><sphereGeometry args={[0.8, 12, 8]} /><meshStandardMaterial color="#e7d9a8" /></mesh>
          <mesh position={[0, 0.05, -1.15]}><sphereGeometry args={[0.28, 10, 8]} /><meshStandardMaterial color="#8a9a55" /></mesh>
          {[[-1, -0.5], [1, -0.5], [-0.8, 0.7], [0.8, 0.7]].map(([x, z], k) => (
            <mesh key={k} ref={(el) => { flippers.current[i][k] = el; }} position={[x * 0.9, -0.05, z]} scale={[1, 0.12, k < 2 ? 0.6 : 0.4]}>
              <sphereGeometry args={[0.7, 8, 6]} /><meshStandardMaterial color="#8a9a55" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
