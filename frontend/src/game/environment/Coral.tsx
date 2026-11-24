import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from '../terrainData.ts';
import { fbm, mulberry32 } from '../noise.ts';

const PALETTES: Record<string, string[]> = {
  branch: ['#ff6b6b', '#ff8e53', '#f472b6', '#fb7185', '#fbbf24'],
  brain: ['#d6a35c', '#c98f6a', '#9bbf7a', '#b9a46c'],
  fan: ['#a78bfa', '#c084fc', '#f0abfc', '#818cf8'],
  tube: ['#38bdf8', '#2dd4bf', '#60a5fa', '#a3e635'],
};

function branchingGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.12, 0.2, 1.2, 6);
  trunk.translate(0, 0.6, 0);
  parts.push(trunk);
  for (let k = 0; k < 5; k++) {
    const b = new THREE.CylinderGeometry(0.04, 0.11, 0.95, 5);
    b.translate(0, 0.47, 0);
    b.rotateZ(0.6 + (k % 2) * 0.3);
    b.rotateY(k * 1.26);
    b.translate(0, 0.55 + k * 0.12, 0);
    parts.push(b);
  }
  return mergeGeometries(parts)!;
}

function brainGeometry() {
  const g = new THREE.IcosahedronGeometry(0.8, 3);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = 1 + 0.09 * Math.sin(x * 14) * Math.sin(z * 14 + y * 6);
    pos.setXYZ(i, x * r, Math.max(y, -0.05) * r * 0.65, z * r);
  }
  g.computeVertexNormals();
  return g;
}

function fanGeometry() {
  const g = new THREE.SphereGeometry(1, 14, 10);
  g.scale(1, 1.1, 0.08);
  g.translate(0, 0.95, 0);
  return g;
}

function tubeGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  [[0, 0, 1.2], [0.3, 0.1, 0.8], [-0.25, 0.2, 1.0], [0.05, -0.3, 0.6]].forEach(([x, z, h]) => {
    const c = new THREE.CylinderGeometry(0.12, 0.17, h, 8, 1, true);
    c.translate(x, h / 2, z);
    parts.push(c);
  });
  return mergeGeometries(parts)!;
}

interface Layer { kind: keyof typeof PALETTES; geometry: THREE.BufferGeometry; base: number; scale: [number, number]; seed: number; side?: THREE.Side }

/** Coral reef: four instanced coral types scattered in clusters on the shallow shelf. */
export function CoralField({ density }: { density: number }) {
  const layers = useMemo<Layer[]>(() => [
    { kind: 'branch', geometry: branchingGeometry(), base: 170, scale: [0.9, 2.6], seed: 101 },
    { kind: 'brain', geometry: brainGeometry(), base: 110, scale: [0.9, 2.8], seed: 202 },
    { kind: 'fan', geometry: fanGeometry(), base: 90, scale: [0.8, 2.2], seed: 303 },
    { kind: 'tube', geometry: tubeGeometry(), base: 90, scale: [0.8, 2.0], seed: 404, side: THREE.DoubleSide },
  ], []);

  return (
    <>
      {layers.map((l) => <CoralLayer key={l.kind + density} layer={l} count={Math.round(l.base * density)} />)}
    </>
  );
}

function CoralLayer({ layer, count }: { layer: Layer; count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  useEffect(() => {
    const rng = mulberry32(layer.seed);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const palette = PALETTES[layer.kind];
    // Cluster centres inside the reef shelf.
    const centres: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2, r = 25 + rng() * 150;
      centres.push([Math.cos(a) * r, Math.sin(a) * r - 10]);
    }
    let placed = 0;
    for (let tries = 0; tries < count * 12 && placed < count; tries++) {
      const [cx, cz] = centres[Math.floor(rng() * centres.length)];
      const x = cx + (rng() + rng() + rng() - 1.5) * 26;
      const z = cz + (rng() + rng() + rng() - 1.5) * 26;
      const y = heightAt(x, z);
      if (y > -4 || y < -48) continue;
      if (fbm(x / 20, z / 20, 5, 3) < 0.35) continue; // leave sand patches between colonies
      dummy.position.set(x, y - 0.12, z);
      dummy.rotation.set((rng() - 0.5) * 0.25, rng() * Math.PI * 2, (rng() - 0.5) * 0.25);
      dummy.scale.setScalar(layer.scale[0] + rng() * (layer.scale[1] - layer.scale[0]));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(placed, dummy.matrix);
      col.set(palette[Math.floor(rng() * palette.length)]).offsetHSL((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.08);
      mesh.current.setColorAt(placed, col);
      placed++;
    }
    mesh.current.count = placed;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [layer, count]);

  return (
    <instancedMesh ref={mesh} args={[layer.geometry, undefined, Math.max(1, count)]} frustumCulled={false}>
      <meshStandardMaterial color="#ffffff" roughness={0.7} side={layer.side ?? THREE.FrontSide} />
    </instancedMesh>
  );
}
