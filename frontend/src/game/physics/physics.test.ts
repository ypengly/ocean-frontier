import { describe, it, expect } from 'vitest';
import { createSub, stepSub, createVitals, stepVitals, forwardOf, engineEfficiency } from './submarine.ts';
import { SUB_CLASSES, computeStats, EMPTY_UPGRADES } from '../constants.ts';

const stats = SUB_CLASSES.explorer.base;
const env = { floorY: -200, current: [0, 0, 0] as [number, number, number], efficiency: 1, powered: true, halfWorld: 300 };

function run(seconds: number, input: { throttle: number; turn: number; vertical: number }, sub = createSub(0, -50, 0)) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) stepSub(sub, input, stats, env, dt);
  return sub;
}

describe('submarine physics', () => {
  it('accelerates forward and approaches top speed without exceeding it', () => {
    const sub = run(25, { throttle: 1, turn: 0, vertical: 0 });
    const v = Math.hypot(sub.vx, sub.vz);
    expect(v).toBeGreaterThan(stats.maxSpeed * 0.85);
    expect(v).toBeLessThan(stats.maxSpeed * 1.05);
    expect(sub.z).toBeLessThan(-100); // yaw 0 faces -z
  });

  it('keeps coasting (inertia) then slows down by drag', () => {
    const sub = run(10, { throttle: 1, turn: 0, vertical: 0 });
    const v0 = Math.hypot(sub.vx, sub.vz);
    run(1, { throttle: 0, turn: 0, vertical: 0 }, sub);
    const v1 = Math.hypot(sub.vx, sub.vz);
    expect(v1).toBeGreaterThan(0.3 * v0);
    expect(v1).toBeLessThan(v0);
  });

  it('turns left and right', () => {
    const left = run(2, { throttle: 0.5, turn: -1, vertical: 0 });
    const right = run(2, { throttle: 0.5, turn: 1, vertical: 0 });
    expect(left.yaw).toBeGreaterThan(0);
    expect(right.yaw).toBeLessThan(0);
  });

  it('clamps to the surface and the sea floor', () => {
    const up = run(30, { throttle: 0, turn: 0, vertical: 1 });
    expect(up.y).toBeLessThanOrEqual(0);
    const sub = createSub(0, -10, 0);
    const res = stepSub(sub, { throttle: 0, turn: 0, vertical: -1 }, stats, { ...env, floorY: -10.5 }, 1 / 60);
    expect(sub.y).toBeGreaterThanOrEqual(-10.5 + 1.5);
    expect(res.impact).toBeGreaterThanOrEqual(0);
  });

  it('floats upward when power is lost', () => {
    const sub = createSub(0, -50, 0);
    for (let i = 0; i < 300; i++) stepSub(sub, { throttle: 0, turn: 0, vertical: 0 }, stats, { ...env, powered: false }, 1 / 60);
    expect(sub.y).toBeGreaterThan(-50);
  });

  it('currents push a drifting sub', () => {
    const sub = createSub(0, -50, 0);
    for (let i = 0; i < 600; i++) stepSub(sub, { throttle: 0, turn: 0, vertical: 0 }, stats, { ...env, current: [1, 0, 0] }, 1 / 60);
    expect(sub.x).toBeGreaterThan(2);
  });

  it('forward vector matches yaw convention', () => {
    const [x, , z] = forwardOf(0);
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(-1);
  });
});

describe('vitals', () => {
  const ctx = { depth: 30, throttle: 0, lightsOn: false, sonarActive: false, impact: 0, overpressure: false };

  it('drains oxygen when submerged and refills at the surface', () => {
    const v = createVitals(stats);
    stepVitals(v, stats, ctx, 10);
    expect(v.oxygen).toBeLessThan(stats.oxygen);
    stepVitals(v, stats, { ...ctx, depth: 0 }, 5);
    expect(v.oxygen).toBeGreaterThan(stats.oxygen - 10);
  });

  it('drains the battery faster at full throttle', () => {
    const a = createVitals(stats);
    const b = createVitals(stats);
    stepVitals(a, stats, ctx, 10);
    stepVitals(b, stats, { ...ctx, throttle: 1 }, 10);
    expect(b.battery).toBeLessThan(a.battery);
  });

  it('damages the hull past the safe depth and eventually fails', () => {
    const v = createVitals(stats);
    for (let i = 0; i < 400; i++) stepVitals(v, stats, { ...ctx, depth: 200, overpressure: true }, 1);
    expect(v.hull).toBe(0);
    expect(v.alive).toBe(false);
    expect(v.failure).toBeTruthy();
  });

  it('suffocation only after the emergency reserve is gone', () => {
    const v = createVitals(stats);
    v.oxygen = 0;
    stepVitals(v, stats, ctx, 30);
    expect(v.alive).toBe(true);
    stepVitals(v, stats, ctx, 40);
    expect(v.alive).toBe(false);
  });

  it('overheating reduces engine efficiency', () => {
    const v = createVitals(stats);
    expect(engineEfficiency(v)).toBeCloseTo(1);
    v.temp = 100;
    expect(engineEfficiency(v)).toBeLessThan(1);
  });

  it('upgrades change stats', () => {
    const s = computeStats('explorer', { ...EMPTY_UPGRADES, engine: 2, hull: 1 });
    expect(s.maxSpeed).toBeGreaterThan(stats.maxSpeed);
    expect(s.maxDepth).toBe(stats.maxDepth + 30);
  });
});
