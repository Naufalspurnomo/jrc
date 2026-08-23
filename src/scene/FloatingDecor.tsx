import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  IcosahedronGeometry,
  OctahedronGeometry,
  TorusGeometry,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
} from 'three';

const GOLD = '#d7a63b';
const GOLD_PALE = '#f2cc74';
const OXBLOOD = '#601c1e';

/* ─── Floating Polyhedra ─── */
interface FloatingShapeProps {
  position: [number, number, number];
  geometry: 'icosahedron' | 'octahedron' | 'torus';
  color: string;
  scale?: number;
  speed?: number;
  rotAxis?: [number, number, number];
}

function FloatingShape({
  position,
  geometry,
  color,
  scale = 1,
  speed = 0.3,
  rotAxis = [0.3, 1, 0.2],
}: FloatingShapeProps) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    ref.current.rotation.x = t * rotAxis[0];
    ref.current.rotation.y = t * rotAxis[1];
    ref.current.rotation.z = t * rotAxis[2];
    ref.current.position.y = position[1] + Math.sin(t * 0.8) * 0.15;
  });

  const geo = useMemo(() => {
    switch (geometry) {
      case 'icosahedron':
        return new IcosahedronGeometry(0.3 * scale, 0);
      case 'octahedron':
        return new OctahedronGeometry(0.25 * scale, 0);
      case 'torus':
        return new TorusGeometry(0.2 * scale, 0.06 * scale, 8, 16);
    }
  }, [geometry, scale]);

  return (
    <mesh ref={ref} position={position} geometry={geo}>
      <meshStandardMaterial
        color={new Color(color)}
        roughness={0.35}
        metalness={0.6}
        wireframe={geometry === 'torus'}
      />
    </mesh>
  );
}

/* ─── Dust Stream ─── */
function DustStream({ count = 30 }: { count?: number }) {
  const ref = useRef<Points>(null);

  const { geometry, speeds } = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const s = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 2.5;
      pos[s] = Math.cos(theta) * r;
      pos[s + 1] = Math.random() * 4 - 1;
      pos[s + 2] = Math.sin(theta) * r;
      spd[i] = 0.08 + Math.random() * 0.2;
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    return { geometry: geo, speeds: spd };
  }, [count]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const attr = ref.current.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < speeds.length; i++) {
      const s = i * 3;
      arr[s] += Math.sin(state.clock.elapsedTime * 0.5 + i) * delta * 0.02;
      arr[s + 1] += speeds[i] * delta;
      if (arr[s + 1] > 3.5) {
        arr[s + 1] = -1;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color={GOLD_PALE}
        size={0.035}
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

/* ─── Main Scene ─── */
function DecorScene() {
  return (
    <>
      <FloatingShape position={[-1.8, 0.5, -0.5]} geometry="icosahedron" color={GOLD} scale={1.2} speed={0.25} />
      <FloatingShape position={[1.6, -0.2, -0.3]} geometry="octahedron" color={OXBLOOD} scale={1} speed={0.35} />
      <FloatingShape position={[0.3, 1.2, -0.8]} geometry="torus" color={GOLD_PALE} scale={1.4} speed={0.2} />
      <FloatingShape position={[-0.8, -0.8, -0.4]} geometry="icosahedron" color={OXBLOOD} scale={0.8} speed={0.4} />
      <FloatingShape position={[2.2, 0.8, -0.6]} geometry="octahedron" color={GOLD} scale={0.7} speed={0.3} />
      <DustStream count={25} />
    </>
  );
}

/* ─── Exported Canvas Component ─── */
export interface FloatingDecorProps {
  className?: string;
}

export function FloatingDecor({ className = '' }: FloatingDecorProps) {
  return (
    <div className={`floating-decor ${className}`} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0.5, 4], fov: 40 }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 4, 3]} intensity={0.7} color={new Color('#ffd596')} />
        <pointLight position={[0, 1, 2]} intensity={0.5} color={new Color(GOLD)} distance={8} />
        <DecorScene />
      </Canvas>
    </div>
  );
}

export default FloatingDecor;
