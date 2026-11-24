import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../stores/gameStore.ts';
import { POIS, poiPosition, type PoiDef } from './pois.ts';
import { useTarget } from './creatures/useTarget.ts';
import { heightAt } from './terrainData.ts';
import { mulberry32 } from './noise.ts';

export const WRECK_POS: [number, number, number] = [120, heightAt(120, -40) + 0.5, -40];

const rock = <meshStandardMaterial color="#4b5563" roughness={1} />;

function Body({ p }: { p: PoiDef }) {
  switch (p.kind) {
    case 'copper':
      return (<group>{[[0, 0, 0, 0.9], [0.9, 0, 0.3, 0.6], [-0.7, 0, -0.4, 0.5]].map(([x, y, z, r], i) => (<mesh key={i} position={[x, y, z]} scale={r}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#7c5a44" emissive="#2f9e7a" emissiveIntensity={0.35} roughness={0.8} /></mesh>))}</group>);
    case 'titanium':
      return (<group>{[0, 1, 2].map((i) => (<mesh key={i} position={[i * 0.6 - 0.6, i * 0.1, 0]} rotation={[0.2 * i, i, 0.1]} scale={[0.5, 1.1 - i * 0.2, 0.5]}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#9fb3c8" metalness={0.85} roughness={0.3} emissive="#38bdf8" emissiveIntensity={0.15} /></mesh>))}</group>);
    case 'sample':
      return (<group><mesh scale={[1, 0.5, 1]}><dodecahedronGeometry args={[0.9, 0]} />{rock}</mesh><mesh position={[0, 0.8, 0]}><sphereGeometry args={[0.4, 14, 10]} /><meshStandardMaterial color="#5eead4" emissive="#2dd4bf" emissiveIntensity={1.6} transparent opacity={0.85} /></mesh><pointLight color="#5eead4" intensity={12} distance={9} decay={2} position={[0, 1, 0]} /></group>);
    case 'crystal':
      return (<group>{[0, 1, 2, 3].map((i) => (<mesh key={i} position={[Math.cos(i * 1.6) * 0.6, 0.6, Math.sin(i * 1.6) * 0.6]} rotation={[0.25 * Math.cos(i), 0, 0.25 * Math.sin(i)]} scale={[0.3, 1.2 + (i % 2) * 0.6, 0.3]}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={1.8} /></mesh>))}<pointLight color="#a78bfa" intensity={25} distance={16} decay={2} position={[0, 1.2, 0]} /></group>);
    case 'wreck_chest':
      return (<group rotation={[0.1, 0.5, 0.15]}><mesh><boxGeometry args={[1.8, 1, 1.1]} /><meshStandardMaterial color="#5c3d22" roughness={0.9} /></mesh><mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1]}><cylinderGeometry args={[0.55, 0.55, 1.8, 12, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#6b4423" roughness={0.9} /></mesh><mesh position={[0, 0.2, 0.58]}><boxGeometry args={[0.25, 0.3, 0.08]} /><meshStandardMaterial color="#f5c542" emissive="#f59e0b" emissiveIntensity={0.9} metalness={0.9} roughness={0.3} /></mesh></group>);
    case 'pillar':
      return (<group><mesh position={[0, 1, 0]}><boxGeometry args={[4.2, 2, 4.2]} /><meshStandardMaterial color="#6b7280" roughness={1} /></mesh><mesh position={[0, 8, 0]}><cylinderGeometry args={[1.1, 1.35, 13, 12]} /><meshStandardMaterial color="#8b95a1" roughness={0.9} /></mesh>{[4, 7, 10].map((y) => (<mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, y]}><torusGeometry args={[1.25, 0.07, 6, 20]} /><meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={1.6} /></mesh>))}<mesh position={[1.6, 0.9, 1.2]} rotation={[0.3, 0.4, 1.3]}><cylinderGeometry args={[1, 1.1, 3, 10]} /><meshStandardMaterial color="#7b8591" roughness={1} /></mesh><pointLight color="#22d3ee" intensity={60} distance={30} decay={2} position={[0, 8, 0]} /></group>);
    case 'cave':
      return (<group rotation={[0, 0.6, 0]}><mesh position={[0, 0, 0]} rotation={[0, 0, 0]}><torusGeometry args={[5.5, 2.4, 10, 20, Math.PI]} />{rock}</mesh>{[-6.5, 6.5].map((x) => (<mesh key={x} position={[x, 0, 0]}><sphereGeometry args={[2.6, 10, 8]} />{rock}</mesh>))}<mesh position={[0, 2.6, -0.4]}><circleGeometry args={[4.6, 24, 0, Math.PI]} /><meshBasicMaterial color="#00040a" side={THREE.DoubleSide} /></mesh><pointLight color="#38bdf8" intensity={6} distance={10} decay={2} position={[0, 1.5, 1]} /></group>);
    case 'garden': {
      const rng = mulberry32(5);
      return (<group>{Array.from({ length: 26 }, (_, i) => { const a = rng() * 6.28, r = rng() * 7; const h = 0.8 + rng() * 2.2; return (<mesh key={i} position={[Math.cos(a) * r, h / 2, Math.sin(a) * r]}><coneGeometry args={[0.3 + rng() * 0.3, h, 6]} /><meshStandardMaterial color={i % 2 ? '#f0abfc' : '#67e8f9'} emissive={i % 2 ? '#d946ef' : '#06b6d4'} emissiveIntensity={1.3} /></mesh>); })}<pointLight color="#e879f9" intensity={35} distance={24} decay={2} position={[0, 3, 0]} /></group>);
    }
  }
  return null;
}

function Poi({ p }: { p: PoiDef }) {
  const pos = useMemo(() => poiPosition(p), [p]);
  const collected = useGameStore((s) => !!s.collected[p.id] && p.category === 'Resource');
  const revealed = useGameStore((s) => !!s.revealed[p.id]);
  const scanned = useGameStore((s) => s.journal.some((e) => e.id === p.id));
  const beacon = useRef<THREE.Group>(null!);

  const target = useMemo(() => collected ? null : ({
    id: p.id, name: p.name, kind: 'poi' as const, category: p.category, info: p.info, scanTime: p.scanTime, range: p.kind === 'pillar' ? 26 : 14, reward: p.reward,
    pos: (o: { x: number; y: number; z: number }) => { o.x = pos[0]; o.y = pos[1] + (p.kind === 'pillar' ? 6 : 0); o.z = pos[2]; },
  }), [p, pos, collected]);
  useTarget(target);

  useFrame((s) => { if (beacon.current) { beacon.current.visible = revealed && !scanned; beacon.current.scale.y = 1 + Math.sin(s.clock.elapsedTime * 3) * 0.08; } });

  if (collected) return null;
  return (
    <group position={pos}>
      <Body p={p} />
      <group ref={beacon} visible={false}>
        <mesh position={[0, 7, 0]}><cylinderGeometry args={[0.06, 0.06, 14, 6]} /><meshBasicMaterial color="#67e8f9" transparent opacity={0.7} fog={false} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
        <mesh position={[0, 14.4, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.8, 0.07, 6, 24]} /><meshBasicMaterial color="#67e8f9" fog={false} /></mesh>
      </group>
    </group>
  );
}

function Wreck() {
  return (
    <group position={[WRECK_POS[0] - 14, WRECK_POS[1] + 1.5, WRECK_POS[2] + 6]} rotation={[0.12, 0.7, 0.35]}>
      <mesh><boxGeometry args={[24, 6, 8]} /><meshStandardMaterial color="#4a3b32" roughness={1} /></mesh>
      <mesh position={[8, 4.5, 0]}><boxGeometry args={[6, 3.5, 6]} /><meshStandardMaterial color="#5a4a3e" roughness={1} /></mesh>
      <mesh position={[-4, 6, 0]} rotation={[0, 0, 0.3]}><cylinderGeometry args={[0.2, 0.25, 9, 6]} /><meshStandardMaterial color="#3b3b3b" /></mesh>
      <mesh position={[-11.5, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[3.5, 4, 4]} /><meshStandardMaterial color="#4a3b32" roughness={1} /></mesh>
    </group>
  );
}

export function PointsOfInterest() {
  return (<>{POIS.map((p) => <Poi key={p.id} p={p} />)}<Wreck /></>);
}
