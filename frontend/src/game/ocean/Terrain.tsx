import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_HALF } from '../constants.ts';
import { heightAt } from '../terrainData.ts';
import { smoothstep } from '../noise.ts';

const SEGMENTS = 192;

const CAUSTIC_GLSL = /* glsl */ `
float caustic(vec2 p, float t) {
  float v = 0.0;
  vec2 q = p;
  for (int i = 0; i < 3; i++) {
    q += vec2(sin(q.y * 1.3 + t * (0.6 + float(i) * 0.2)), cos(q.x * 1.1 - t * (0.5 + float(i) * 0.15))) * 0.6;
    v += 1.0 - abs(sin(q.x * 1.7) * sin(q.y * 1.9));
  }
  v /= 3.0;
  return pow(smoothstep(0.55, 1.0, v), 3.0);
}`;

export function Terrain() {
  const shaderRef = useRef<{ uniforms: Record<string, { value: number }> } | null>(null);

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, SEGMENTS, SEGMENTS);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    const normal = g.attributes.normal as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const ny = normal.getY(i);
      const sand = smoothstep(-85, -25, y) * smoothstep(0.55, 0.88, ny);
      const v = 0.92 + 0.08 * Math.sin(pos.getX(i) * 0.31) * Math.cos(pos.getZ(i) * 0.27);
      colors[i * 3] = (0.17 + (0.79 - 0.17) * sand) * v;
      colors[i * 3 + 1] = (0.21 + (0.69 - 0.21) * sand) * v;
      colors[i * 3 + 2] = (0.27 + (0.48 - 0.27) * sand) * v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\n${CAUSTIC_GLSL}`)
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float cAmt = caustic(vWPos.xz * 0.11, uTime) * smoothstep(-75.0, -4.0, vWPos.y);
          totalEmissiveRadiance += vec3(0.30, 0.62, 0.72) * cAmt * 0.85;`,
        );
      shaderRef.current = shader as unknown as { uniforms: Record<string, { value: number }> };
    };
    m.customProgramCacheKey = () => 'ocean-terrain-caustics';
    return m;
  }, []);

  useFrame((state) => {
    if (shaderRef.current) shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
