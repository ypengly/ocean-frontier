import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore.ts';
import { forwardOf } from '../physics/submarine.ts';
import { subRuntime } from '../world.ts';

const POOL = 90;

interface Bubble { x: number; y: number; z: number; life: number; size: number; wob: number }

/** Bubble pool: one trail from the submarine plus fixed emitters (for example, a wreck). */
export function Bubbles({ emitters }: { emitters: [number, number, number][] }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pool = useMemo<Bubble[]>(() => Array.from({ length: POOL }, () => ({ x: 0, y: 0, z: 0, life: 0, size: 0.1, wob: Math.random() * 6 })), []);
  const budget = useRef(0);
  const cursor = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = useGameStore.getState();
    const running = s.screen === 'playing' && !s.paused;
    if (running) {
      const [fx, , fz] = forwardOf(subRuntime.yaw);
      budget.current += dt * (1.5 + Math.abs(subRuntime.throttle) * 14);
      while (budget.current >= 1) {
        budget.current -= 1;
        const b = pool[cursor.current++ % POOL];
        b.x = subRuntime.x - fx * 3 + (Math.random() - 0.5) * 0.8; b.y = subRuntime.y + (Math.random() - 0.5) * 0.6; b.z = subRuntime.z - fz * 3 + (Math.random() - 0.5) * 0.8;
        b.life = 4 + Math.random() * 3; b.size = 0.06 + Math.random() * 0.1;
      }
      for (const e of emitters) {
        if (Math.random() < dt * 2.5) {
          const b = pool[cursor.current++ % POOL];
          b.x = e[0] + (Math.random() - 0.5) * 1.5; b.y = e[1]; b.z = e[2] + (Math.random() - 0.5) * 1.5;
          b.life = 6 + Math.random() * 4; b.size = 0.1 + Math.random() * 0.2;
        }
      }
    }
    const t = performance.now() / 1000;
    for (let i = 0; i < POOL; i++) {
      const b = pool[i];
      if (running && b.life > 0) {
        b.life -= dt;
        b.y += (1.3 + b.size * 4) * dt;
        b.x += Math.sin(t * 2 + b.wob) * 0.25 * dt;
        b.z += Math.cos(t * 1.7 + b.wob) * 0.25 * dt;
        if (b.y > -0.2) b.life = 0;
      }
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.setScalar(b.life > 0 ? b.size * Math.min(1, b.life * 1.5) : 0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, POOL]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color="#d9fbff" transparent opacity={0.45} depthWrite={false} />
    </instancedMesh>
  );
}
