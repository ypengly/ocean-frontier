import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGameStore } from '../../stores/gameStore.ts';
import { clamp, mulberry32 } from '../noise.ts';
import { clock, subRuntime } from '../world.ts';
import { currentAt, heightAt } from '../terrainData.ts';
import { speciesById } from '../species.ts';
import { useTarget } from './useTarget.ts';

const HOME: [number, number] = [20, 75];

/** Moon jellyfish that drift on the ocean current field and pulse their bells. */
export function Jellyfish({ count }: { count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => {
    const bell = new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const parts: THREE.BufferGeometry[] = [bell];
    for (let i = 0; i < 6; i++) {
      const c = new THREE.CylinderGeometry(0.015, 0.01, 1.3, 4);
      const a = (i / 6) * Math.PI * 2;
      c.translate(Math.cos(a) * 0.3, -0.65, Math.sin(a) * 0.3);
      parts.push(c);
    }
    return mergeGeometries(parts)!;
  }, []);
  const jel = useMemo(() => {
    const rng = mulberry32(77);
    return Array.from({ length: count }, () => ({ x: HOME[0] + (rng() - 0.5) * 70, y: -10 - rng() * 14, z: HOME[1] + (rng() - 0.5) * 70, ph: rng() * 6.28, s: 0.8 + rng() * 1.3 }));
  }, [count]);
  const sp = speciesById('jellyfish')!;
  const target = useMemo(() => ({
    id: sp.id, name: sp.name, kind: 'creature' as const, category: sp.category, info: `${sp.info} (${sp.latin})`, scanTime: sp.scanTime, range: 16,
    pos: (o: { x: number; y: number; z: number }) => {
      let best = jel[0], bd = Infinity;
      for (const j of jel) { const d = Math.hypot(j.x - subRuntime.x, j.y - subRuntime.y, j.z - subRuntime.z); if (d < bd) { bd = d; best = j; } }
      o.x = best.x; o.y = best.y; o.z = best.z;
    },
  }), [sp, jel]);
  useTarget(target);
  useEffect(() => { const c = new THREE.Color(); jel.forEach((_, i) => { c.set(i % 3 ? '#c7e9ff' : '#e9d5ff'); mesh.current.setColorAt(i, c); }); if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true; }, [jel]);

  useFrame((state, delta) => {
    const s = useGameStore.getState();
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const paused = s.screen === 'playing' && s.paused;
    jel.forEach((j, i) => {
      if (!paused) {
        const [cx, cy, cz] = currentAt(j.x, j.y, j.z, clock.t + t);
        j.x += (cx * 1.8 + (HOME[0] - j.x) * 0.004) * dt;
        j.z += (cz * 1.8 + (HOME[1] - j.z) * 0.004) * dt;
        j.y += (cy + Math.sin(t * 2 + j.ph) * 0.35) * dt;
        j.y = clamp(j.y, heightAt(j.x, j.z) + 3, -4);
      }
      const pulse = Math.sin(t * 2 + j.ph);
      dummy.position.set(j.x, j.y, j.z);
      dummy.scale.set(j.s * (1 - pulse * 0.1), j.s * (1 + pulse * 0.14), j.s * (1 - pulse * 0.1));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#c7e9ff" emissive="#7dd3fc" emissiveIntensity={0.9} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
    </instancedMesh>
  );
}
