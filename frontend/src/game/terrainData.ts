import { fbm, clamp, smoothstep } from './noise.ts';
import { WORLD_HALF } from './constants.ts';

export const TERRAIN_SEED = 7;

/** Sea floor height in metres (negative = below the surface). Shared by rendering, collision and placement. */
export function heightAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);
  const slope = Math.pow(clamp((z + 40) / (WORLD_HALF + 40), 0, 1), 1.6) * 190;
  const base = -22 - slope;
  const hillAmp = 34 * (0.3 + 0.7 * smoothstep(70, 240, dist));
  const hills = (fbm(x / 70, z / 70, TERRAIN_SEED, 5) - 0.5) * hillAmp;
  const dunes = (fbm(x / 14, z / 14, TERRAIN_SEED + 7, 3) - 0.5) * 3;
  return base + hills + dunes;
}

export type ZoneId = 'reef' | 'open_water' | 'abyssal_trench';

export function zoneAt(x: number, z: number): ZoneId {
  const floor = heightAt(x, z);
  if (floor > -60) return 'reef';
  if (floor > -120) return 'open_water';
  return 'abyssal_trench';
}

export const ZONE_LABEL: Record<ZoneId, string> = {
  reef: 'Tropical Coral Reef',
  open_water: 'Open water',
  abyssal_trench: 'Abyssal Trench rim',
};

/** Smooth, depth-fading current field. Mirrors simulation/ecosystem/model.py::current_at. */
export function currentAt(x: number, y: number, z: number, t: number): [number, number, number] {
  const fade = Math.exp(y / 120);
  return [
    (Math.sin(z * 0.011 + t * 0.07) * 0.35 + 0.1) * fade,
    Math.sin(t * 0.1 + x * 0.02) * 0.03 * fade,
    Math.cos(x * 0.009 - t * 0.05) * 0.3 * fade,
  ];
}
