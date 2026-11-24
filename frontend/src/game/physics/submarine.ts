// Submarine rigid-body model and survival vitals. Pure functions so they can be unit tested.
import { clamp } from '../noise.ts';
import type { SubStats } from '../constants.ts';

export interface SubPhysics {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number; roll: number; yawRate: number;
}

export interface SubInput { throttle: number; turn: number; vertical: number }

export interface PhysicsEnv {
  floorY: number; // sea floor height under the sub
  current: [number, number, number];
  efficiency: number; // 0..1 engine output multiplier
  powered: boolean;
  halfWorld: number;
}

export interface StepResult { impact: number; hitBounds: boolean }

export const SURFACE_Y = 0;
export const FLOOR_CLEARANCE = 1.6;

export function createSub(x = 0, y = -10, z = 60, yaw = 0): SubPhysics {
  return { x, y, z, vx: 0, vy: 0, vz: 0, yaw, pitch: 0, roll: 0, yawRate: 0 };
}

export function forwardOf(yaw: number): [number, number, number] {
  return [-Math.sin(yaw), 0, -Math.cos(yaw)];
}

export function speedOf(s: SubPhysics): number {
  return Math.hypot(s.vx, s.vy, s.vz);
}

export function stepSub(s: SubPhysics, input: SubInput, stats: SubStats, env: PhysicsEnv, dt: number): StepResult {
  const power = env.powered ? env.efficiency : 0;
  const [fx, , fz] = forwardOf(s.yaw);

  const throttle = clamp(input.throttle, -1, 1) * (input.throttle < 0 ? 0.55 : 1); // reverse is weaker
  const vertical = clamp(input.vertical, -1, 1);
  const thrust = stats.thrust * power;

  // Net buoyancy: slightly positive when powered, an emergency blow to the surface when the batteries are dead.
  const buoyancy = env.powered ? 0.08 : 0.45;

  // Drag acts on velocity relative to the water, so currents push the sub.
  const rvx = s.vx - env.current[0];
  const rvy = s.vy - env.current[1];
  const rvz = s.vz - env.current[2];
  const rel = Math.hypot(rvx, rvy, rvz);
  const linear = 0.15;
  const quad = Math.max(0.001, (stats.thrust - linear * stats.maxSpeed) / (stats.maxSpeed * stats.maxSpeed));

  const ax = fx * thrust * throttle - (linear + quad * rel) * rvx;
  const ay = thrust * 0.7 * vertical + buoyancy - (linear + quad * rel * 1.4) * rvy;
  const az = fz * thrust * throttle - (linear + quad * rel) * rvz;

  s.vx += ax * dt;
  s.vy += ay * dt;
  s.vz += az * dt;

  // Yaw: rudder authority scales with water flow over the hull.
  const speed = Math.hypot(s.vx, s.vz);
  const authority = 0.35 + 0.65 * clamp(speed / (stats.maxSpeed * 0.5), 0, 1);
  const targetRate = -clamp(input.turn, -1, 1) * stats.turnRate * authority * (power > 0 ? 1 : 0.2);
  s.yawRate += (targetRate - s.yawRate) * Math.min(1, dt * 3.2);
  s.yaw += s.yawRate * dt;

  const targetPitch = clamp(s.vy / Math.max(1, stats.maxSpeed * 0.7), -1, 1) * 0.45;
  s.pitch += (targetPitch - s.pitch) * Math.min(1, dt * 3);
  const targetRoll = clamp(-s.yawRate * 0.5, -0.5, 0.5);
  s.roll += (targetRoll - s.roll) * Math.min(1, dt * 3);

  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;

  let impact = 0;
  let hitBounds = false;

  if (s.y > SURFACE_Y) {
    s.y = SURFACE_Y;
    if (s.vy > 0) s.vy = 0;
  }
  const minY = env.floorY + FLOOR_CLEARANCE;
  if (s.y < minY) {
    impact = Math.max(0, -s.vy);
    s.y = minY;
    if (s.vy < 0) s.vy = 0;
    // Scrape friction on the seabed
    s.vx *= 0.9;
    s.vz *= 0.9;
  }
  const lim = env.halfWorld - 6;
  if (Math.abs(s.x) > lim) { s.x = clamp(s.x, -lim, lim); s.vx = 0; hitBounds = true; }
  if (Math.abs(s.z) > lim) { s.z = clamp(s.z, -lim, lim); s.vz = 0; hitBounds = true; }

  return { impact, hitBounds };
}

// ---------------------------------------------------------------------------------------------

export interface Vitals {
  oxygen: number;
  emergencyO2: number;
  battery: number;
  hull: number;
  engine: number; // engine integrity 0..100
  temp: number; // engine temperature 0..120
  maxDepthReached: number;
  alive: boolean;
  failure: string | null;
}

export const EMERGENCY_O2 = 60;

export function createVitals(stats: SubStats): Vitals {
  return { oxygen: stats.oxygen, emergencyO2: EMERGENCY_O2, battery: stats.battery, hull: stats.hull, engine: 100, temp: 20, maxDepthReached: 0, alive: true, failure: null };
}

export interface VitalsCtx { depth: number; throttle: number; lightsOn: boolean; sonarActive: boolean; impact: number; overpressure: boolean }

export function engineEfficiency(v: Vitals): number {
  const integrity = 0.4 + 0.6 * (v.engine / 100);
  const overheat = v.temp > 92 ? 0.6 : 1;
  return integrity * overheat;
}

export function isSurfaced(depth: number): boolean { return depth < 2.5; }

export function stepVitals(v: Vitals, stats: SubStats, c: VitalsCtx, dt: number): void {
  if (!v.alive) return;
  v.maxDepthReached = Math.max(v.maxDepthReached, c.depth);

  // Oxygen: air lasts longer shallow. The surface refills it.
  if (isSurfaced(c.depth)) {
    v.oxygen = Math.min(stats.oxygen, v.oxygen + 90 * dt);
    v.emergencyO2 = Math.min(EMERGENCY_O2, v.emergencyO2 + 10 * dt);
    v.battery = Math.min(stats.battery, v.battery + 14 * dt);
  } else if (v.oxygen > 0) {
    v.oxygen = Math.max(0, v.oxygen - (1 + c.depth / 400) * dt);
  } else {
    v.emergencyO2 = Math.max(0, v.emergencyO2 - dt);
  }

  // Energy
  const draw = 0.25 + 1.6 * Math.abs(c.throttle) + (c.lightsOn ? 0.3 * stats.light : 0) + (c.sonarActive ? 0.8 : 0);
  v.battery = Math.max(0, v.battery - draw * dt);

  // Engine temperature
  const heat = Math.abs(c.throttle) * (v.battery > 0 ? 7 : 0);
  v.temp = clamp(v.temp + (heat - (v.temp - 20) * 0.12) * dt, 20, 120);
  if (v.temp > 105) v.engine = Math.max(0, v.engine - 1.2 * dt);

  // Pressure and impacts
  if (c.overpressure) {
    const over = c.depth - stats.maxDepth;
    v.hull -= (1 + over * 0.12) * dt;
  }
  if (c.impact > 2.5) {
    const dmg = (c.impact - 2.5) * 3;
    v.hull -= dmg;
    v.engine = Math.max(0, v.engine - dmg * 0.5);
  }
  v.hull = Math.max(0, v.hull);

  if (v.hull <= 0) { v.alive = false; v.failure = 'The hull failed.'; }
  else if (v.oxygen <= 0 && v.emergencyO2 <= 0) { v.alive = false; v.failure = 'The air ran out.'; }
}

export function isOverpressure(depth: number, stats: SubStats): boolean { return depth > stats.maxDepth; }
export function pressureWarning(depth: number, stats: SubStats): boolean { return depth > stats.maxDepth * 0.85; }
export function pressureAtm(depth: number): number { return 1 + depth / 10; }
