import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore.ts';
import { subRuntime } from '../world.ts';
import { heightAt } from '../terrainData.ts';
import { createShark, stepShark } from './sharkAI.ts';
import { speciesById } from '../species.ts';
import { useTarget } from './useTarget.ts';

const WAYPOINTS: [number, number, number][] = [[80, 0, 40], [30, 0, 110], [-70, 0, 70], [-90, 0, -30], [-20, 0, -90], [70, 0, -60]].map(([x, , z]) => [x, Math.min(-10, heightAt(x, z) + 9), z]);

/** Blacktip reef shark with a patrol / investigate / circle / leave state machine (see sharkAI.ts). */
export function ReefShark() {
  const group = useRef<THREE.Group>(null!);
  const tail = useRef<THREE.Group>(null!);
  const shark = useMemo(() => createShark(WAYPOINTS[0][0], WAYPOINTS[0][1], WAYPOINTS[0][2]), []);
  const sp = speciesById('reef_shark')!;
  const target = useMemo(() => ({
    id: sp.id, name: sp.name, kind: 'creature' as const, category: sp.category, info: `${sp.info} (${sp.latin})`, scanTime: sp.scanTime, range: 26,
    pos: (o: { x: number; y: number; z: number }) => { o.x = shark.x; o.y = shark.y; o.z = shark.z; },
  }), [sp, shark]);
  useTarget(target);

  useFrame((_, delta) => {
    const s = useGameStore.getState();
    if (!(s.screen === 'playing' && s.paused)) {
      stepShark(shark, Math.min(delta, 0.05), { x: subRuntime.x, y: subRuntime.y, z: subRuntime.z, speed: subRuntime.speed, lightsOn: subRuntime.lightsOn }, WAYPOINTS, heightAt);
    }
    const g = group.current;
    g.position.set(shark.x, shark.y, shark.z);
    g.rotation.set(shark.pitch, shark.yaw, 0, 'YXZ');
    tail.current.rotation.y = Math.sin(shark.tailPhase) * 0.35;
  });

  const skin = <meshStandardMaterial color="#7e8b97" roughness={0.55} metalness={0.1} />;
  return (
    <group ref={group} scale={1.25}>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.9]}><capsuleGeometry args={[0.55, 2.6, 6, 12]} />{skin}</mesh>
      <mesh position={[0, 0, -1.9]} scale={[0.9, 0.7, 1.3]}><sphereGeometry args={[0.5, 12, 8]} />{skin}</mesh>
      <mesh position={[0, 0.7, -0.2]} rotation={[-0.3, 0, 0]}><coneGeometry args={[0.35, 1.1, 4]} />{skin}</mesh>
      {[-1, 1].map((x) => (<mesh key={x} position={[x * 0.75, -0.3, -0.8]} rotation={[0, 0, x * -1.1]} scale={[1, 1, 0.12]}><coneGeometry args={[0.35, 1.3, 4]} />{skin}</mesh>))}
      <group ref={tail} position={[0, 0, 1.7]}>
        <mesh position={[0, 0, 0.7]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.4, 1.6, 6]} />{skin}</mesh>
        <mesh position={[0, 0.45, 1.5]} rotation={[0.5, 0, 0]} scale={[0.12, 1, 1]}><coneGeometry args={[0.5, 1.2, 4]} />{skin}</mesh>
      </group>
      <mesh position={[0, 0.7, -0.2]} scale={[0.4, 0.15, 0.3]}><sphereGeometry args={[0.5, 6, 6]} /><meshStandardMaterial color="#111827" /></mesh>
    </group>
  );
}
