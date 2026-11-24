import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mulberry32 } from '../noise.ts';

const BOX = 70;

/** Marine snow and suspended sediment. Motion and wrapping run entirely in the vertex shader. */
export function MarineSnow({ count }: { count: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const geometry = useMemo(() => {
    const rng = mulberry32(42);
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < p.length; i++) p[i] = (rng() - 0.5) * BOX;
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, [count]);
  const uniforms = useMemo(() => ({ uCenter: { value: new THREE.Vector3() }, uTime: { value: 0 }, uBox: { value: BOX }, uPx: { value: 4 } }), []);

  useFrame((state) => {
    uniforms.uCenter.value.copy(state.camera.position);
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPx.value = 3.2 * state.gl.getPixelRatio();
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={/* glsl */ `
          uniform vec3 uCenter; uniform float uTime; uniform float uBox; uniform float uPx;
          varying float vA;
          void main() {
            vec3 p = position + vec3(sin(uTime * 0.1 + position.y), -uTime * 0.35, cos(uTime * 0.08 + position.x));
            p = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5 + uCenter;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uPx * (26.0 / max(length(mv.xyz), 1.0));
            vA = smoothstep(uBox * 0.5, uBox * 0.28, length(p - uCenter));
          }`}
        fragmentShader={/* glsl */ `
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.1, d) * vA * 0.55;
            gl_FragColor = vec4(0.75, 0.95, 1.0, a);
          }`}
      />
    </points>
  );
}
