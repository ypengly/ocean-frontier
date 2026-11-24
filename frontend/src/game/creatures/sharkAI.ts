// Reef shark behaviour: patrols, investigates unfamiliar activity, circles, then leaves. Pure state machine.
import { clamp } from '../noise.ts';

export type SharkState = 'patrol' | 'investigate' | 'circle' | 'leave';

export interface Shark {
  x: number; y: number; z: number;
  yaw: number; pitch: number; speed: number;
  state: SharkState;
  timer: number;
  cooldown: number;
  waypoint: number;
  orbit: number;
  tailPhase: number;
}

export interface SubSense { x: number; y: number; z: number; speed: number; lightsOn: boolean }

export function createShark(x: number, y: number, z: number): Shark {
  return { x, y, z, yaw: 0, pitch: 0, speed: 2, state: 'patrol', timer: 0, cooldown: 0, waypoint: 0, orbit: 0, tailPhase: 0 };
}

function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const SPEED: Record<SharkState, number> = { patrol: 2.2, investigate: 3.6, circle: 3.0, leave: 4.8 };

export function stepShark(s: Shark, dt: number, sub: SubSense, waypoints: [number, number, number][], floorAt: (x: number, z: number) => number): void {
  const dx0 = sub.x - s.x, dy0 = sub.y - s.y, dz0 = sub.z - s.z;
  const distSub = Math.hypot(dx0, dy0, dz0);
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.timer = Math.max(0, s.timer - dt);

  let tx = s.x, ty = s.y, tz = s.z;

  switch (s.state) {
    case 'patrol': {
      const wp = waypoints[s.waypoint % waypoints.length];
      tx = wp[0]; ty = wp[1]; tz = wp[2];
      if (Math.hypot(wp[0] - s.x, wp[2] - s.z) < 10) s.waypoint = (s.waypoint + 1) % waypoints.length;
      if (s.cooldown <= 0 && distSub < 55 && (sub.speed > 0.8 || sub.lightsOn)) {
        s.state = 'investigate';
        s.timer = 16;
      }
      break;
    }
    case 'investigate': {
      tx = sub.x; ty = sub.y; tz = sub.z;
      if (distSub < 17) { s.state = 'circle'; s.timer = 10; s.orbit = Math.atan2(s.z - sub.z, s.x - sub.x); }
      else if (s.timer <= 0) { s.state = 'leave'; s.timer = 10; }
      break;
    }
    case 'circle': {
      s.orbit += 0.42 * dt;
      tx = sub.x + Math.cos(s.orbit) * 15;
      tz = sub.z + Math.sin(s.orbit) * 15;
      ty = sub.y;
      const startled = sub.speed > 7 && distSub < 11;
      if (s.timer <= 0 || startled) { s.state = 'leave'; s.timer = 10; }
      break;
    }
    case 'leave': {
      const away = Math.hypot(s.x - sub.x, s.z - sub.z) || 1;
      tx = s.x + ((s.x - sub.x) / away) * 60;
      tz = s.z + ((s.z - sub.z) / away) * 60;
      ty = s.y;
      if (s.timer <= 0) { s.state = 'patrol'; s.cooldown = 30; }
      break;
    }
  }

  const floor = floorAt(tx, tz) + 3;
  ty = clamp(ty, floor, -3);

  const desiredYaw = Math.atan2(-(tx - s.x), -(tz - s.z));
  const turn = clamp(angleDiff(s.yaw, desiredYaw), -1.1 * dt, 1.1 * dt);
  s.yaw += turn;
  const horiz = Math.hypot(tx - s.x, tz - s.z) || 1;
  const desiredPitch = clamp(Math.atan2(ty - s.y, horiz), -0.5, 0.5);
  s.pitch += (desiredPitch - s.pitch) * Math.min(1, dt * 2);
  s.speed += (SPEED[s.state] - s.speed) * Math.min(1, dt);

  const cp = Math.cos(s.pitch);
  s.x += -Math.sin(s.yaw) * cp * s.speed * dt;
  s.y += Math.sin(s.pitch) * s.speed * dt;
  s.z += -Math.cos(s.yaw) * cp * s.speed * dt;
  s.y = clamp(s.y, floorAt(s.x, s.z) + 2, -2);
  s.tailPhase += dt * (3 + s.speed * 1.2);
}
