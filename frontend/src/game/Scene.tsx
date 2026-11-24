import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useGameStore, type Quality } from '../stores/gameStore.ts';
import { Terrain } from './ocean/Terrain.tsx';
import { WaterEffects } from './ocean/WaterEffects.tsx';
import { SubmarineController, SubmarineModel } from './submarine/Submarine.tsx';
import { FollowCamera } from './camera/FollowCamera.tsx';
import { MarineSnow } from './environment/Particles.tsx';
import { Bubbles } from './environment/Bubbles.tsx';
import { Seaweed } from './environment/Seaweed.tsx';
import { CoralField } from './environment/Coral.tsx';
import { FishSchool, type SchoolConfig } from './creatures/FishSchool.tsx';
import { ReefShark } from './creatures/Shark.tsx';
import { Turtles } from './creatures/Turtles.tsx';
import { Jellyfish } from './creatures/Jellyfish.tsx';
import { PointsOfInterest, WRECK_POS } from './PointsOfInterest.tsx';
import { GameSystems, RemoteSubs } from './Systems.tsx';

const QUALITY: Record<Quality, { dpr: [number, number]; snow: number; weed: number; coral: number; fish: number; jelly: number }> = {
  low: { dpr: [1, 1], snow: 700, weed: 200, coral: 0.45, fish: 0.45, jelly: 6 },
  medium: { dpr: [1, 1.5], snow: 1800, weed: 450, coral: 0.8, fish: 0.8, jelly: 12 },
  high: { dpr: [1, 2], snow: 3500, weed: 800, coral: 1.15, fish: 1.2, jelly: 18 },
};
const ORDER: Quality[] = ['low', 'medium', 'high'];

const SCHOOLS = (f: number): SchoolConfig[] => [
  { speciesId: 'sardine', count: Math.round(160 * f), size: 0.42, colors: ['#cfe3f2', '#b7d3ea', '#e6f1fa'], homeXZ: [35, 45], hover: 9, radius: 28, seed: 1, scanRange: 26, fleeRadius: 22 },
  { speciesId: 'sardine', count: Math.round(110 * f), size: 0.42, colors: ['#c3d9ea', '#dbe9f4'], homeXZ: [-75, 60], hover: 8, radius: 24, seed: 2, scanRange: 26, fleeRadius: 22 },
  { speciesId: 'clownfish', count: Math.round(26 * f), size: 0.3, colors: ['#ff7a1a', '#ff9a3d', '#f97316'], homeXZ: [-45, -80], hover: 3.5, radius: 10, seed: 3, scanRange: 18, fleeRadius: 10 },
];

export function Scene() {
  const quality = useGameStore((s) => s.quality);
  const q = QUALITY[quality];
  return (
    <Canvas dpr={q.dpr} camera={{ fov: 60, near: 0.3, far: 700, position: [0, -8, 75] }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <PerformanceMonitor onDecline={() => {
        const s = useGameStore.getState();
        if (!s.adaptive) return;
        const i = ORDER.indexOf(s.quality);
        if (i > 0) { s.setQuality(ORDER[i - 1]); s.notify(`Frame rate dropped. Quality set to ${ORDER[i - 1]}.`, 'info'); }
      }} />
      <WaterEffects />
      <Terrain />
      <CoralField density={q.coral} key={`coral-${quality}`} />
      <Seaweed count={q.weed} key={`weed-${quality}`} />
      <MarineSnow count={q.snow} key={`snow-${quality}`} />
      <Bubbles emitters={[[WRECK_POS[0] - 12, WRECK_POS[1] + 4, WRECK_POS[2] + 6], [WRECK_POS[0] - 16, WRECK_POS[1] + 3, WRECK_POS[2] + 5]]} />
      {SCHOOLS(q.fish).map((c, i) => <FishSchool key={`${i}-${quality}`} cfg={c} />)}
      <ReefShark />
      <Turtles />
      <Jellyfish count={q.jelly} key={`jelly-${quality}`} />
      <PointsOfInterest />
      <SubmarineModel />
      <RemoteSubs />
      <SubmarineController />
      <GameSystems />
      <FollowCamera />
    </Canvas>
  );
}
