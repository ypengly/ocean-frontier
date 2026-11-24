import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore.ts';
import { clock, input, sonar, subRuntime } from '../world.ts';
import { WORLD_HALF, type SubClassId } from '../constants.ts';
import { currentAt, heightAt, zoneAt, ZONE_LABEL } from '../terrainData.ts';
import { engineEfficiency, isOverpressure, isSurfaced, pressureWarning, stepSub, stepVitals } from '../physics/submarine.ts';
import { audio } from '../../audio/audioEngine.ts';

const glass = <meshPhysicalMaterial color="#9ff3ff" emissive="#22d3ee" emissiveIntensity={0.7} transparent opacity={0.85} roughness={0.1} />;

function ExplorerHull({ color }: { color: string }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.95, 3.2, 8, 18]} /><meshStandardMaterial color={color} metalness={0.45} roughness={0.35} /></mesh>
      <mesh position={[0, 1.05, 0.3]}><cylinderGeometry args={[0.38, 0.5, 0.8, 12]} /><meshStandardMaterial color={color} metalness={0.4} roughness={0.4} /></mesh>
      <mesh position={[0, 1.7, 0.2]}><cylinderGeometry args={[0.04, 0.04, 0.9, 6]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
      <mesh position={[0, 0.25, -2.0]}><sphereGeometry args={[0.62, 18, 14]} />{glass}</mesh>
      <mesh position={[0, 0.9, 2.1]}><boxGeometry args={[0.12, 1.2, 1]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0, 2.2]}><boxGeometry args={[2.4, 0.1, 0.9]} /><meshStandardMaterial color={color} /></mesh>
    </group>
  );
}

function DeepDiverHull({ color }: { color: string }) {
  return (
    <group>
      <mesh><sphereGeometry args={[1.55, 24, 18]} /><meshStandardMaterial color={color} metalness={0.6} roughness={0.3} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.58, 0.14, 8, 32]} /><meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} /></mesh>
      {[-0.6, 0, 0.6].map((x) => (<mesh key={x} position={[x, 0.2, -1.45 + Math.abs(x) * 0.5]}><sphereGeometry args={[0.3, 12, 10]} />{glass}</mesh>))}
      {[-1.5, 1.5].map((x) => (<mesh key={x} position={[x, -0.2, 1.1]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.28, 0.28, 1.1, 10]} /><meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} /></mesh>))}
      <mesh position={[0, -1.4, 0]}><boxGeometry args={[1.8, 0.2, 2.2]} /><meshStandardMaterial color="#334155" /></mesh>
    </group>
  );
}

function ResearchHull({ color }: { color: string }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.8, 4.2, 8, 18]} /><meshStandardMaterial color={color} metalness={0.4} roughness={0.35} /></mesh>
      <mesh position={[0, 0.6, -0.8]}><sphereGeometry args={[0.85, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />{glass}</mesh>
      <mesh position={[0, 1.8, 1.2]}><cylinderGeometry args={[0.03, 0.03, 2, 6]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
      {[-1, 1].map((x) => (<mesh key={x} position={[x * 0.95, -0.2, -0.4]}><boxGeometry args={[0.35, 0.3, 1.6]} /><meshStandardMaterial color="#334155" /></mesh>))}
      <mesh position={[0, 0.8, 2.4]}><boxGeometry args={[0.1, 1.0, 1]} /><meshStandardMaterial color={color} /></mesh>
    </group>
  );
}

const HULLS: Record<SubClassId, (p: { color: string }) => JSX.Element> = { explorer: ExplorerHull, deep_diver: DeepDiverHull, research: ResearchHull };
const PROP_Z: Record<SubClassId, number> = { explorer: 2.7, deep_diver: 1.9, research: 3.2 };

export function SubmarineModel() {
  const group = useRef<THREE.Group>(null!);
  const prop = useRef<THREE.Group>(null!);
  const spotL = useRef<THREE.SpotLight>(null!);
  const spotR = useRef<THREE.SpotLight>(null!);
  const lamp = useRef<THREE.PointLight>(null!);
  const targetL = useMemo(() => new THREE.Object3D(), []);
  const targetR = useMemo(() => new THREE.Object3D(), []);
  const subClass = useGameStore((s) => s.subClass);
  const color = useGameStore((s) => s.hullColor);
  const lightMult = useGameStore((s) => s.stats.light);
  const lightsOn = useGameStore((s) => s.lightsOn);
  const Hull = HULLS[subClass];

  useEffect(() => {
    if (spotL.current) spotL.current.target = targetL;
    if (spotR.current) spotR.current.target = targetR;
  }, [targetL, targetR]);

  useFrame((state, delta) => {
    const g = group.current;
    g.position.set(subRuntime.x, subRuntime.y, subRuntime.z);
    g.rotation.order = 'YXZ';
    const bob = useGameStore.getState().screen === 'menu' ? Math.sin(state.clock.elapsedTime * 0.8) * 0.25 : 0;
    g.position.y += bob;
    g.rotation.set(subRuntime.pitch, subRuntime.yaw, subRuntime.roll);
    if (prop.current) prop.current.rotation.z += delta * (4 + Math.abs(subRuntime.throttle) * 40);
    const on = lightsOn && subRuntime.powered;
    if (spotL.current) spotL.current.intensity = on ? 700 * lightMult : 0;
    if (spotR.current) spotR.current.intensity = on ? 700 * lightMult : 0;
    if (lamp.current) lamp.current.intensity = on ? 12 * lightMult : 0;
  });

  return (
    <group ref={group}>
      <Hull color={color} />
      <group ref={prop} position={[0, 0, PROP_Z[subClass]]}>
        {[0, 1, 2].map((i) => (<mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} position={[0, 0.0, 0]}><boxGeometry args={[0.12, 1.2, 0.04]} /><meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} /></mesh>))}
      </group>
      <spotLight ref={spotL} position={[-0.7, 0.1, -1.8]} angle={0.55} penumbra={0.7} distance={130} decay={2} color="#d8f6ff" />
      <spotLight ref={spotR} position={[0.7, 0.1, -1.8]} angle={0.55} penumbra={0.7} distance={130} decay={2} color="#d8f6ff" />
      <primitive object={targetL} position={[-0.3, -2, -30]} />
      <primitive object={targetR} position={[0.3, -2, -30]} />
      <pointLight ref={lamp} position={[0, 0.2, -3]} distance={16} decay={2} color="#bff4ff" />
    </group>
  );
}

/** Applies input, physics and survival rules every frame while the game is running. */
export function SubmarineController() {
  const hudTimer = useRef(0);
  const saveTimer = useRef(0);
  const boundsWarn = useRef(-100);
  const lastImpact = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = useGameStore.getState();
    if (s.screen !== 'playing' || s.paused) { audio.update(0, 0); return; }
    clock.t += dt;

    const v = s.vitals;
    const stats = s.stats;
    const depth = -subRuntime.y;
    subRuntime.powered = v.battery > 0;
    subRuntime.throttle = input.throttle;
    const res = stepSub(
      subRuntime,
      { throttle: input.throttle, turn: input.turn, vertical: input.vertical },
      stats,
      { floorY: heightAt(subRuntime.x, subRuntime.z), current: currentAt(subRuntime.x, subRuntime.y, subRuntime.z, clock.t), efficiency: engineEfficiency(v), powered: subRuntime.powered, halfWorld: WORLD_HALF },
      dt,
    );
    subRuntime.speed = Math.hypot(subRuntime.vx, subRuntime.vy, subRuntime.vz);
    subRuntime.depth = -subRuntime.y;

    stepVitals(v, stats, { depth, throttle: input.throttle, lightsOn: s.lightsOn, sonarActive: sonar.active, impact: res.impact, overpressure: isOverpressure(depth, stats) }, dt);
    if (res.impact > 2.5 && clock.t - lastImpact.current > 0.5) { audio.thud(); lastImpact.current = clock.t; s.notify('Hull impact.', 'warn'); }
    if (res.hitBounds && clock.t - boundsWarn.current > 6) { s.notify('Edge of the survey area. Turn back.', 'warn'); boundsWarn.current = clock.t; }

    const warnAlarm = isOverpressure(depth, stats) || (v.oxygen <= 0 && v.emergencyO2 > 0) || v.hull < stats.hull * 0.2;
    audio.setAlarm(warnAlarm);
    audio.update(subRuntime.speed / stats.maxSpeed, depth);

    hudTimer.current += dt;
    if (hudTimer.current >= 0.1) {
      hudTimer.current = 0;
      s.setHud({
        oxygen: v.oxygen, emergencyO2: v.emergencyO2, battery: v.battery, hull: v.hull, engine: v.engine, temp: v.temp,
        depth: Math.max(0, depth), speed: subRuntime.speed, x: subRuntime.x, z: subRuntime.z,
        zone: ZONE_LABEL[zoneAt(subRuntime.x, subRuntime.z)], maxDepth: v.maxDepthReached,
        overpressure: isOverpressure(depth, stats), pressureWarning: pressureWarning(depth, stats), powered: subRuntime.powered,
      });
      s.emitMission({ type: 'depth', depth: Math.max(0, depth) });
      if (isSurfaced(depth)) s.emitMission({ type: 'surface' });
    }

    saveTimer.current += dt;
    if (saveTimer.current > 20) { saveTimer.current = 0; s.saveLocal(); }

    if (!v.alive) { audio.setAlarm(false); s.fail(v.failure ?? 'The expedition ended.'); }
  });

  return null;
}
