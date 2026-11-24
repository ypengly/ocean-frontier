import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clamp, smoothstep } from '../noise.ts';

const STOPS: [number, THREE.Color][] = [
  [0, new THREE.Color('#2ab6d4')],
  [35, new THREE.Color('#0b5f84')],
  [110, new THREE.Color('#051d36')],
  [200, new THREE.Color('#010812')],
  [320, new THREE.Color('#000205')],
];

const tmp = new THREE.Color();
function waterColorAt(depth: number, out: THREE.Color) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [d0, c0] = STOPS[i];
    const [d1, c1] = STOPS[i + 1];
    if (depth <= d1) return out.copy(c0).lerp(c1, clamp((depth - d0) / (d1 - d0), 0, 1));
  }
  return out.copy(STOPS[STOPS.length - 1][1]);
}

function makeShaftTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SHAFT_COUNT = 14;

export function WaterEffects() {
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null!);
  const ambient = useRef<THREE.AmbientLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const shafts = useRef<THREE.Group>(null!);
  const surface = useRef<THREE.Mesh>(null!);
  const fog = useMemo(() => new THREE.FogExp2('#2ab6d4', 0.01), []);
  const shaftTex = useMemo(makeShaftTexture, []);
  const shaftData = useMemo(() => Array.from({ length: SHAFT_COUNT }, (_, i) => ({
    x: Math.sin(i * 12.9898) * 70, z: Math.cos(i * 78.233) * 70, rot: i * 0.9, w: 5 + (i % 4) * 2.2, phase: i * 1.7,
  })), []);

  useEffect(() => {
    scene.fog = fog;
    scene.background = new THREE.Color('#2ab6d4');
    return () => { scene.fog = null; scene.background = null; };
  }, [scene, fog]);

  useFrame((state) => {
    const cam = state.camera.position;
    const depth = Math.max(0, -cam.y);
    waterColorAt(depth, tmp);
    fog.color.copy(tmp);
    (scene.background as THREE.Color).copy(tmp);
    fog.density = 0.009 + smoothstep(0, 170, depth) * 0.024;

    const light = Math.exp(-depth / 42);
    sun.current.intensity = 3.2 * light;
    sun.current.position.set(cam.x + 30, 100, cam.z + 20);
    sun.current.target.position.set(cam.x, cam.y, cam.z);
    sun.current.target.updateMatrixWorld();
    ambient.current.intensity = 0.1 + 0.55 * Math.exp(-depth / 80);
    hemi.current.intensity = 0.65 * Math.exp(-depth / 55);

    if (shafts.current) {
      shafts.current.position.set(Math.round(cam.x / 20) * 20, 0, Math.round(cam.z / 20) * 20);
      const op = 0.5 * Math.exp(-depth / 32);
      shafts.current.visible = op > 0.01;
      shafts.current.children.forEach((child, i) => {
        const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        m.opacity = op * (0.55 + 0.45 * Math.sin(state.clock.elapsedTime * 0.5 + shaftData[i].phase));
      });
    }
    if (surface.current) {
      surface.current.position.set(cam.x, 0, cam.z);
      (surface.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.exp(-depth / 90);
    }
  });

  return (
    <>
      <ambientLight ref={ambient} color="#9fdcff" />
      <hemisphereLight ref={hemi} args={['#8fe6ff', '#0a2a44', 1]} />
      <directionalLight ref={sun} color="#e9fbff" />
      <group ref={shafts}>
        {shaftData.map((s, i) => (
          <mesh key={i} position={[s.x, -34, s.z]} rotation={[0, s.rot, 0.28]}>
            <planeGeometry args={[s.w, 70]} />
            <meshBasicMaterial map={shaftTex} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} color="#bff6ff" />
          </mesh>
        ))}
      </group>
      <mesh ref={surface} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1400, 1400]} />
        <meshBasicMaterial color="#9ff0ff" transparent opacity={0.5} side={THREE.DoubleSide} fog={false} depthWrite={false} />
      </mesh>
    </>
  );
}
