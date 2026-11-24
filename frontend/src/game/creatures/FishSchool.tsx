import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGameStore } from '../../stores/gameStore.ts';
import { clock, subRuntime } from '../world.ts';
import { heightAt } from '../terrainData.ts';
import { createFlock, stepFlock, type FlockParams } from './flocking.ts';
import { speciesById } from '../species.ts';
import { useTarget } from './useTarget.ts';
import { withTimeVertex, type TimeShader } from '../shaderUtil.ts';

// Head points along +Z (Object3D.lookAt aims +Z at the target); tail fin trails behind at -Z.
function fishGeometry() {
  const body = new THREE.SphereGeometry(0.5, 8, 6);
  body.scale(0.4, 0.65, 1.7);
  const tail = new THREE.ConeGeometry(0.42, 0.9, 4);
  tail.rotateX(Math.PI / 2);
  tail.scale(0.12, 1, 1);
  tail.translate(0, 0, -1.0);
  return mergeGeometries([body, tail])!;
}

export interface SchoolConfig {
  speciesId: string;
  count: number;
  size: number;
  colors: string[];
  homeXZ: [number, number];
  hover: number;
  radius: number;
  seed: number;
  scanRange: number;
  fleeRadius: number;
}

export function FishSchool({ cfg }: { cfg: SchoolConfig }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const shader = useRef<TimeShader | null>(null);
  const frame = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(fishGeometry, []);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.25 });
    withTimeVertex(m, 'fish-wiggle', `
      float tw = max(0.0, -position.z - 0.25);
      transformed.x += sin(uTime * 9.0 + instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5) * 0.3 * tw;`, shader);
    return m;
  }, []);

  const flock = useMemo(() => {
    const y = Math.min(-8, heightAt(cfg.homeXZ[0], cfg.homeXZ[1]) + cfg.hover);
    const params: FlockParams = {
      count: cfg.count, cohesion: 0.55, alignment: 0.9, separation: 1.6, neighborRadius: 7, separationRadius: 1.8,
      minSpeed: 1.6, maxSpeed: 4.2, home: [cfg.homeXZ[0], y, cfg.homeXZ[1]], homeRadius: cfg.radius, fleeRadius: cfg.fleeRadius,
      floorClearance: 2.2, maxY: -2.5,
    };
    return createFlock(params, cfg.seed);
  }, [cfg]);

  const sp = speciesById(cfg.speciesId)!;
  const target = useMemo(() => ({
    id: sp.id, name: sp.name, kind: 'creature' as const, category: sp.category, info: `${sp.info} (${sp.latin})`, scanTime: sp.scanTime, range: cfg.scanRange,
    pos: (o: { x: number; y: number; z: number }) => { o.x = flock.centroid[0]; o.y = flock.centroid[1]; o.z = flock.centroid[2]; },
  }), [sp, flock, cfg.scanRange]);
  useTarget(target);

  const colored = useRef(false);
  useFrame((_, delta) => {
    const s = useGameStore.getState();
    const m = mesh.current;
    if (!colored.current) {
      const c = new THREE.Color();
      for (let i = 0; i < cfg.count; i++) { c.set(cfg.colors[i % cfg.colors.length]).offsetHSL(0, 0, ((i * 37) % 10) / 100 - 0.05); m.setColorAt(i, c); }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      colored.current = true;
    }
    if (shader.current) shader.current.uniforms.uTime.value = clock.t + performance.now() / 4000;
    if (s.screen === 'playing' && s.paused) return;

    // Level of detail: distant schools are simulated at a lower rate.
    const dist = Math.hypot(flock.centroid[0] - subRuntime.x, flock.centroid[1] - subRuntime.y, flock.centroid[2] - subRuntime.z);
    const stride = dist > 160 ? 4 : dist > 80 ? 2 : 1;
    frame.current++;
    if (frame.current % stride !== 0) return;
    const dt = Math.min(delta, 0.05) * stride;
    const alarming = subRuntime.speed > 0.4 || dist < 6;
    stepFlock(flock, dt, performance.now() / 1000, alarming ? subRuntime : null, heightAt);

    const { pos, vel } = flock;
    for (let i = 0; i < cfg.count; i++) {
      const i3 = i * 3;
      dummy.position.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
      dummy.lookAt(pos[i3] + vel[i3], pos[i3 + 1] + vel[i3 + 1], pos[i3 + 2] + vel[i3 + 2]);
      dummy.scale.setScalar(cfg.size);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, cfg.count]} frustumCulled={false} />;
}
