import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../stores/gameStore.ts';
import { CONTACT_MEMORY, SONAR_SPEED, clock, contacts, input, remotes, scanState, sonar, subRuntime, targets, type Vec3Like } from './world.ts';
import { audio } from '../audio/audioEngine.ts';
import { sendDiscovery } from '../hooks/useMultiplayer.ts';
import { lerp } from './noise.ts';

const tmp: Vec3Like = { x: 0, y: 0, z: 0 };

/** Sonar ping propagation, passive detection and the scanner. Runs after the controller each frame. */
export function GameSystems() {
  const passive = useRef(0);
  const tick = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = useGameStore.getState();
    if (s.screen !== 'playing' || s.paused) return;

    // Sonar ring expanding at SONAR_SPEED; everything it passes over is marked as a contact.
    if (sonar.active) {
      sonar.radius = (clock.t - sonar.pingStart) * SONAR_SPEED;
      targets.forEach((t, id) => {
        t.pos(tmp);
        const d = Math.hypot(tmp.x - subRuntime.x, tmp.y - subRuntime.y, tmp.z - subRuntime.z);
        if (d <= sonar.radius && d <= sonar.maxRange) {
          contacts.set(id, { seenAt: clock.t });
          if (t.kind === 'poi') s.reveal(id);
        }
      });
      if (sonar.radius > sonar.maxRange) sonar.active = false;
    }

    // Passive detection of anything very close, plus pruning of stale contacts.
    passive.current += dt;
    if (passive.current > 0.3) {
      passive.current = 0;
      targets.forEach((t, id) => {
        t.pos(tmp);
        if (Math.hypot(tmp.x - subRuntime.x, tmp.y - subRuntime.y, tmp.z - subRuntime.z) < 30) contacts.set(id, { seenAt: clock.t });
      });
      contacts.forEach((c, id) => { if (clock.t - c.seenAt > CONTACT_MEMORY || !targets.has(id)) contacts.delete(id); });
    }

    // Scanner: choose the nearest target in range, fill progress while E is held.
    let best: { id: string; d: number } | null = null;
    targets.forEach((t, id) => {
      t.pos(tmp);
      const d = Math.hypot(tmp.x - subRuntime.x, tmp.y - subRuntime.y, tmp.z - subRuntime.z);
      if (d <= t.range && (!best || d < best.d)) best = { id, d };
    });
    const found = best as { id: string; d: number } | null;
    if (!found) {
      scanState.targetId = null; scanState.progress = 0; scanState.scanning = false; scanState.lock = false;
      return;
    }
    if (found.id !== scanState.targetId) { scanState.targetId = found.id; scanState.progress = 0; scanState.lock = false; }
    const t = targets.get(found.id)!;
    scanState.name = t.name;
    scanState.dist = found.d;
    if (!s.paused && !useGameStore.getState().panel && input.scanHeld && !scanState.lock) {
      scanState.scanning = true;
      scanState.progress += dt / t.scanTime;
      tick.current += dt;
      if (tick.current > 0.2) { tick.current = 0; audio.scanTick(); }
      if (scanState.progress >= 1) {
        scanState.progress = 0; scanState.lock = true; scanState.scanning = false;
        const isNew = !s.journal.some((e) => e.id === t.id) && !s.collected[t.id];
        s.completeScan(t);
        if (t.category === 'Resource') audio.collect(); else audio.discovery();
        if (isNew && t.category !== 'Resource') sendDiscovery(t.id, t.name);
      }
    } else {
      scanState.scanning = false;
      scanState.progress = Math.max(0, scanState.progress - dt * 1.5);
      if (!input.scanHeld) scanState.lock = false;
    }
  });
  return null;
}

/** Other players' submarines: a fixed pool of ghost meshes, interpolated toward the latest network pose. */
export function RemoteSubs() {
  const POOL = 7;
  const refs = useRef<(THREE.Group | null)[]>([]);
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.8, 3, 6, 12), []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-10 * Math.min(delta, 0.1));
    const list = Array.from(remotes.values());
    for (let i = 0; i < POOL; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const r = list[i];
      g.visible = !!r;
      if (!r) continue;
      r.x = lerp(r.x, r.tx, k); r.y = lerp(r.y, r.ty, k); r.z = lerp(r.z, r.tz, k);
      r.yaw = lerp(r.yaw, r.tyaw, k); r.pitch = lerp(r.pitch, r.tpitch, k);
      g.position.set(r.x, r.y, r.z);
      g.rotation.set(r.pitch, r.yaw, 0, 'YXZ');
    }
  });

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }} visible={false}>
          <mesh geometry={geo} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial color="#34d6ea" emissive="#0e93ad" emissiveIntensity={0.6} metalness={0.4} roughness={0.4} /></mesh>
          <mesh position={[0, 0.2, -1.9]}><sphereGeometry args={[0.45, 12, 10]} /><meshStandardMaterial color="#e0fbff" emissive="#7ee8f5" emissiveIntensity={1} /></mesh>
          <pointLight intensity={8} distance={14} decay={2} color="#7ee8f5" position={[0, 0.2, -2.5]} />
        </group>
      ))}
    </>
  );
}

