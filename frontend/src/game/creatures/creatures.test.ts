import { describe, it, expect } from 'vitest';
import { createFlock, stepFlock } from './flocking.ts';
import { createShark, stepShark } from './sharkAI.ts';
import { applyEvent, MISSIONS, initialMissions } from '../missions.ts';

const floor = () => -60;
const params = { count: 60, cohesion: 0.5, alignment: 0.8, separation: 1.2, neighborRadius: 8, separationRadius: 2, minSpeed: 1, maxSpeed: 4, home: [0, -20, 0] as [number, number, number], homeRadius: 25, fleeRadius: 20, floorClearance: 2, maxY: -3 };

describe('flocking', () => {
  it('stays near its home range', () => {
    const f = createFlock(params, 3);
    for (let i = 0; i < 1800; i++) stepFlock(f, 1 / 30, i / 30, null, floor);
    const d = Math.hypot(f.centroid[0], f.centroid[1] + 20, f.centroid[2]);
    expect(d).toBeLessThan(params.homeRadius * 1.5);
  });

  it('scatters away from a threat', () => {
    const f = createFlock(params, 5);
    for (let i = 0; i < 120; i++) stepFlock(f, 1 / 30, i / 30, null, floor);
    const threat = { x: f.centroid[0] + 4, y: f.centroid[1], z: f.centroid[2] };
    const dist = () => { let s = 0; for (let i = 0; i < params.count; i++) s += Math.hypot(f.pos[i * 3] - threat.x, f.pos[i * 3 + 1] - threat.y, f.pos[i * 3 + 2] - threat.z); return s / params.count; };
    const d0 = dist();
    for (let i = 0; i < 60; i++) stepFlock(f, 1 / 30, i / 30, threat, floor);
    expect(dist()).toBeGreaterThan(d0);
  });

  it('respects floor and surface limits', () => {
    const f = createFlock({ ...params, home: [0, -8, 0] }, 9);
    for (let i = 0; i < 900; i++) stepFlock(f, 1 / 30, i / 30, null, () => -12);
    for (let i = 0; i < params.count; i++) {
      expect(f.pos[i * 3 + 1]).toBeLessThan(0);
      expect(f.pos[i * 3 + 1]).toBeGreaterThan(-16);
    }
  });
});

describe('shark AI', () => {
  const wps: [number, number, number][] = [[40, -20, 0], [0, -20, 40], [-40, -20, 0], [0, -20, -40]];

  it('investigates a nearby moving sub, circles, then leaves and returns to patrol', () => {
    const s = createShark(30, -20, 0);
    const sub = { x: 10, y: -20, z: 0, speed: 3, lightsOn: true };
    const seen = new Set<string>();
    let leftThenPatrolled = false;
    for (let t = 0; t < 120; t += 0.1) {
      const before = s.state;
      stepShark(s, 0.1, sub, wps, floor);
      seen.add(s.state);
      if (before === 'leave' && s.state === 'patrol') leftThenPatrolled = true;
    }
    expect(seen.has('investigate')).toBe(true);
    expect(seen.has('circle')).toBe(true);
    expect(seen.has('leave')).toBe(true);
    expect(leftThenPatrolled).toBe(true);
  });

  it('ignores a distant sub', () => {
    const s = createShark(30, -20, 0);
    for (let t = 0; t < 30; t += 0.1) stepShark(s, 0.1, { x: 500, y: -20, z: 500, speed: 5, lightsOn: true }, wps, floor);
    expect(s.state).toBe('patrol');
  });
});

describe('missions', () => {
  it('counts only first-time species scans', () => {
    const def = MISSIONS.find((m) => m.id === 'sci_species')!;
    let st = initialMissions().find((m) => m.id === def.id)!;
    st = applyEvent(def, st, { type: 'scan', kind: 'creature', targetId: 'sardine', firstTime: true });
    st = applyEvent(def, st, { type: 'scan', kind: 'creature', targetId: 'sardine', firstTime: false });
    expect(st.progress).toBe(1);
    st = applyEvent(def, st, { type: 'scan', kind: 'creature', targetId: 'sea_turtle', firstTime: true });
    st = applyEvent(def, st, { type: 'scan', kind: 'creature', targetId: 'reef_shark', firstTime: true });
    expect(st.done).toBe(true);
  });

  it('dive and return needs depth first, then the surface', () => {
    const def = MISSIONS.find((m) => m.id === 'sur_depth')!;
    let st = initialMissions().find((m) => m.id === def.id)!;
    st = applyEvent(def, st, { type: 'surface' });
    expect(st.done).toBe(false);
    st = applyEvent(def, st, { type: 'depth', depth: 71 });
    expect(st.stage).toBe(1);
    st = applyEvent(def, st, { type: 'surface' });
    expect(st.done).toBe(true);
  });
});
