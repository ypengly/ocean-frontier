// Boid flocking with home range, threat avoidance and floor avoidance. Pure and allocation-free per step.
import { clamp, mulberry32 } from '../noise.ts';

export interface FlockParams {
  count: number;
  cohesion: number;
  alignment: number;
  separation: number;
  neighborRadius: number;
  separationRadius: number;
  minSpeed: number;
  maxSpeed: number;
  home: [number, number, number];
  homeRadius: number;
  fleeRadius: number;
  floorClearance: number;
  maxY: number;
}

export interface Flock {
  params: FlockParams;
  pos: Float32Array;
  vel: Float32Array;
  phase: Float32Array;
  centroid: [number, number, number];
}

export interface Threat { x: number; y: number; z: number }

export function createFlock(params: FlockParams, seed = 1): Flock {
  const rng = mulberry32(seed);
  const n = params.count;
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = params.home[0] + (rng() - 0.5) * params.homeRadius;
    pos[i * 3 + 1] = params.home[1] + (rng() - 0.5) * params.homeRadius * 0.3;
    pos[i * 3 + 2] = params.home[2] + (rng() - 0.5) * params.homeRadius;
    const a = rng() * Math.PI * 2;
    vel[i * 3] = Math.cos(a) * params.minSpeed;
    vel[i * 3 + 2] = Math.sin(a) * params.minSpeed;
    phase[i] = rng() * Math.PI * 2;
  }
  return { params, pos, vel, phase, centroid: [...params.home] as [number, number, number] };
}

export function stepFlock(f: Flock, dt: number, time: number, threat: Threat | null, floorAt: (x: number, z: number) => number): void {
  const p = f.params;
  const n = p.count;
  const { pos, vel } = f;
  const nr2 = p.neighborRadius * p.neighborRadius;
  const sr2 = p.separationRadius * p.separationRadius;
  let cx = 0, cy = 0, cz = 0;

  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    const px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
    let coX = 0, coY = 0, coZ = 0, alX = 0, alY = 0, alZ = 0, seX = 0, seY = 0, seZ = 0, near = 0;

    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const j3 = j * 3;
      const dx = pos[j3] - px, dy = pos[j3 + 1] - py, dz = pos[j3 + 2] - pz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > nr2) continue;
      near++;
      coX += dx; coY += dy; coZ += dz;
      alX += vel[j3]; alY += vel[j3 + 1]; alZ += vel[j3 + 2];
      if (d2 < sr2 && d2 > 1e-6) {
        const inv = 1 / d2;
        seX -= dx * inv; seY -= dy * inv; seZ -= dz * inv;
      }
    }

    let ax = 0, ay = 0, az = 0;
    if (near > 0) {
      ax += (coX / near) * p.cohesion + (alX / near - vel[i3]) * p.alignment + seX * p.separation;
      ay += (coY / near) * p.cohesion + (alY / near - vel[i3 + 1]) * p.alignment + seY * p.separation;
      az += (coZ / near) * p.cohesion + (alZ / near - vel[i3 + 2]) * p.alignment + seZ * p.separation;
    }

    // Wander: slow, per-individual drift so schools do not move in straight lines.
    const ph = f.phase[i];
    ax += Math.sin(time * 0.7 + ph) * 0.5;
    ay += Math.sin(time * 0.43 + ph * 1.7) * 0.15;
    az += Math.cos(time * 0.6 + ph) * 0.5;

    // Home range: pull back once outside the radius.
    const hx = p.home[0] - px, hy = p.home[1] - py, hz = p.home[2] - pz;
    const hd = Math.hypot(hx, hy, hz);
    if (hd > p.homeRadius) {
      const k = (hd - p.homeRadius) * 0.35 / hd;
      ax += hx * k; ay += hy * k; az += hz * k;
    }

    // Predator avoidance: scatter away from the threat and speed up.
    let speedCap = p.maxSpeed;
    if (threat) {
      const tx = px - threat.x, ty = py - threat.y, tz = pz - threat.z;
      const td = Math.hypot(tx, ty, tz);
      if (td < p.fleeRadius && td > 1e-4) {
        const k = ((p.fleeRadius - td) / p.fleeRadius) * 14 / td;
        ax += tx * k; ay += ty * k * 0.5; az += tz * k;
        speedCap = p.maxSpeed * 1.9;
      }
    }

    // Floor and surface avoidance.
    const floor = floorAt(px, pz) + p.floorClearance;
    if (py < floor) ay += (floor - py) * 6;
    if (py > p.maxY) ay -= (py - p.maxY) * 6;

    vel[i3] += ax * dt; vel[i3 + 1] += ay * dt; vel[i3 + 2] += az * dt;
    const sp = Math.hypot(vel[i3], vel[i3 + 1], vel[i3 + 2]) || 1e-6;
    const target = clamp(sp, p.minSpeed, speedCap);
    const s = target / sp;
    vel[i3] *= s; vel[i3 + 1] *= s; vel[i3 + 2] *= s;
  }

  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    pos[i3] += vel[i3] * dt;
    pos[i3 + 1] += vel[i3 + 1] * dt;
    pos[i3 + 2] += vel[i3 + 2] * dt;
    cx += pos[i3]; cy += pos[i3 + 1]; cz += pos[i3 + 2];
  }
  f.centroid[0] = cx / n; f.centroid[1] = cy / n; f.centroid[2] = cz / n;
}
