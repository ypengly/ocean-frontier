// Mutable per-frame runtime state shared between 3D systems and the HUD. Kept outside React state on purpose:
// it changes every frame and must not trigger re-renders.
import { createSub } from './physics/submarine.ts';

export interface Vec3Like { x: number; y: number; z: number }

export interface Target {
  id: string;
  name: string;
  kind: 'creature' | 'poi';
  category: string;
  info: string;
  scanTime: number; // seconds of continuous scanning
  range: number; // metres
  pos: (out: Vec3Like) => void;
  reward?: { item: string; qty: number };
}

export const subRuntime = { ...createSub(0, -12, 60), speed: 0, throttle: 0, lightsOn: true, depth: 12, powered: true };
export const input = { throttle: 0, turn: 0, vertical: 0, scanHeld: false };
export const targets = new Map<string, Target>();
export const sonar = { pingStart: -100, radius: 0, active: false, maxRange: 140 };
export const contacts = new Map<string, { seenAt: number }>();
export const scanState = { targetId: null as string | null, progress: 0, name: '', dist: 0, scanning: false, lock: false };
export const clock = { t: 0 };

export interface RemoteSub { id: string; name: string; x: number; y: number; z: number; yaw: number; pitch: number; tx: number; ty: number; tz: number; tyaw: number; tpitch: number; speed: number; seen: boolean }
export const remotes = new Map<string, RemoteSub>();

export function resetRuntime(x = 0, y = -12, z = 60) {
  Object.assign(subRuntime, createSub(x, y, z), { speed: 0, throttle: 0, depth: -y, powered: true });
  scanState.targetId = null;
  scanState.progress = 0;
  scanState.scanning = false;
  sonar.active = false;
  contacts.clear();
}

export const SONAR_SPEED = 70; // m/s expanding ring
export const SONAR_COOLDOWN = 2.5;
export const CONTACT_MEMORY = 14; // seconds a pinged contact stays on the display
