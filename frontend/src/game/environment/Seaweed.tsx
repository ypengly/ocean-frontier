import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt } from '../terrainData.ts';
import { mulberry32 } from '../noise.ts';
import { withTimeVertex, type TimeShader } from '../shaderUtil.ts';

const GREENS = ['#2f9e4f', '#3fb56a', '#6aa84f', '#1f8a5b', '#8fbf3f'];

/** Animated seaweed: one instanced mesh, swaying in the vertex shader (no per-frame CPU cost). */
export function Seaweed({ count }: { count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const shader = useRef<TimeShader | null>(null);
  const geometry = useMemo(() => { const g = new THREE.CylinderGeometry(0.03, 0.15, 1, 5, 7, true); g.translate(0, 0.5, 0); return g; }, []);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide });
    withTimeVertex(m, 'seaweed-sway', `
      float sw = position.y;
      float ph = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2;
      transformed.x += sin(uTime * 1.3 + ph + sw * 2.5) * 0.35 * sw * sw;
      transformed.z += cos(uTime * 1.1 + ph * 1.3 + sw * 2.0) * 0.25 * sw * sw;`, shader);
    return m;
  }, []);

  useEffect(() => {
    const rng = mulberry32(11);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let placed = 0;
    for (let tries = 0; tries < count * 8 && placed < count; tries++) {
      const cx = (rng() - 0.5) * 420, cz = (rng() - 0.5) * 420;
      // Clumps: only keep points that fall inside patches of a low-frequency pattern.
      if (Math.sin(cx * 0.045) * Math.cos(cz * 0.05) < -0.15) continue;
      const y = heightAt(cx, cz);
      if (y > -5 || y < -50) continue;
      dummy.position.set(cx, y - 0.1, cz);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      const h = 0.9 + rng() * 2.6;
      dummy.scale.set(0.8 + rng() * 0.7, h, 0.8 + rng() * 0.7);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(placed, dummy.matrix);
      col.set(GREENS[Math.floor(rng() * GREENS.length)]).offsetHSL(0, 0, (rng() - 0.5) * 0.08);
      mesh.current.setColorAt(placed, col);
      placed++;
    }
    mesh.current.count = placed;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [count]);

  useFrame((state) => { if (shader.current) shader.current.uniforms.uTime.value = state.clock.elapsedTime; });

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />;
}
