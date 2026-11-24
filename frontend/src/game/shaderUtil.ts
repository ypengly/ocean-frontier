import * as THREE from 'three';

export interface TimeShader { uniforms: Record<string, { value: number }> }

/** Adds a `uTime` uniform and injects GLSL into the vertex shader of a standard material. */
export function withTimeVertex(material: THREE.MeshStandardMaterial, key: string, vertexBody: string, holder: { current: TimeShader | null }) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`);
    holder.current = shader as unknown as TimeShader;
  };
  material.customProgramCacheKey = () => key;
}
