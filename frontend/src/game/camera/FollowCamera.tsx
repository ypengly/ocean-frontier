import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore.ts';
import { subRuntime } from '../world.ts';
import { forwardOf } from '../physics/submarine.ts';
import { heightAt } from '../terrainData.ts';
import { clamp } from '../noise.ts';

/** Smooth third-person chase camera. Orbits slowly around the sub on the main menu. */
export function FollowCamera() {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, -12, 50));
  const desired = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const initialised = useRef(false);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const screen = useGameStore.getState().screen;
    const [fx, , fz] = forwardOf(subRuntime.yaw);
    const cam = camera as THREE.PerspectiveCamera;

    if (screen === 'menu') {
      const a = state.clock.elapsedTime * 0.12;
      desired.current.set(subRuntime.x + Math.cos(a) * 14, subRuntime.y + 3.5, subRuntime.z + Math.sin(a) * 14);
      target.current.set(subRuntime.x, subRuntime.y, subRuntime.z);
    } else {
      const dist = 13 + subRuntime.speed * 0.25;
      desired.current.set(subRuntime.x - fx * dist, subRuntime.y + 3.6 - subRuntime.pitch * 4, subRuntime.z - fz * dist);
      target.current.set(subRuntime.x + fx * 7, subRuntime.y + 0.8, subRuntime.z + fz * 7);
    }

    desired.current.y = clamp(desired.current.y, heightAt(desired.current.x, desired.current.z) + 1.4, -0.9);
    const k = initialised.current ? 1 - Math.exp(-3.8 * dt) : 1;
    camera.position.lerp(desired.current, k);
    look.current.lerp(target.current, initialised.current ? 1 - Math.exp(-6 * dt) : 1);
    camera.lookAt(look.current);
    initialised.current = true;

    const fov = 58 + clamp(subRuntime.speed, 0, 14) * 0.9;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
  });

  return null;
}
