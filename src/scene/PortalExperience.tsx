import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
} from 'three';

const GOLD = '#d7a63b';
const GOLD_PALE = '#f2cc74';
const OXBLOOD = '#601c1e';
const COAL = '#100c0b';

/* ─── Gate Pillar ─── */
function GatePillar({ side }: { side: 'left' | 'right' }) {
  const x = side === 'left' ? -1.6 : 1.6;
  return (
    <group position={[x, 0, 0]}>
      {/* Base block */}
      <mesh position={[0, -0.8, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.6]} />
        <meshStandardMaterial color={new Color('#c9a06a')} roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Main pillar */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.35, 2.4, 0.35]} />
        <meshStandardMaterial color={new Color('#ddd0b8')} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Gold capital */}
      <mesh position={[0, 1.95, 0]}>
        <boxGeometry args={[0.5, 0.15, 0.5]} />
        <meshStandardMaterial
          color={new Color(GOLD)}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      {/* Gold base band */}
      <mesh position={[0, -0.55, 0]}>
        <boxGeometry args={[0.5, 0.1, 0.5]} />
        <meshStandardMaterial
          color={new Color(GOLD)}
          roughness={0.35}
          metalness={0.65}
          opacity={0.8}
          transparent
        />
      </mesh>
    </group>
  );
}

/* ─── Gate Arch ─── */
function GateArch() {
  return (
    <group position={[0, 1.95, 0]}>
      {/* Main lintel */}
      <mesh>
        <boxGeometry args={[3.8, 0.2, 0.5]} />
        <meshStandardMaterial color={new Color('#ddd0b8')} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Gold inlay */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[3.2, 0.06, 0.52]} />
        <meshStandardMaterial
          color={new Color(GOLD)}
          roughness={0.3}
          metalness={0.7}
          emissive={new Color(GOLD)}
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Top cornice */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[4.0, 0.12, 0.55]} />
        <meshStandardMaterial color={new Color('#c9a06a')} roughness={0.8} metalness={0.1} />
      </mesh>
    </group>
  );
}

/* ─── Glowing Gate Interior ─── */
function GateGlow() {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const mat = ref.current.material as MeshStandardMaterial;
    mat.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 1.2) * 0.2;
  });

  return (
    <mesh ref={ref} position={[0, 0.4, -0.1]}>
      <planeGeometry args={[2.8, 2.8]} />
      <meshStandardMaterial
        color={new Color(GOLD)}
        emissive={new Color(GOLD)}
        emissiveIntensity={0.5}
        transparent
        opacity={0.08}
        depthWrite={false}
        side={2}
      />
    </mesh>
  );
}

/* ─── Rising Embers ─── */
function RisingEmbers({ count = 25 }: { count?: number }) {
  const ref = useRef<Points>(null);

  const { geometry, speeds } = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const s = i * 3;
      pos[s] = (Math.random() - 0.5) * 2.4;
      pos[s + 1] = Math.random() * 3 - 0.5;
      pos[s + 2] = (Math.random() - 0.5) * 0.8;
      spd[i] = 0.15 + Math.random() * 0.35;
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
      arr[s] += Math.sin(state.clock.elapsedTime + i) * delta * 0.03;
      arr[s + 1] += speeds[i] * delta;
      if (arr[s + 1] > 3.2) {
        arr[s + 1] = -0.5;
        arr[s] = (Math.random() - 0.5) * 2.4;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color={GOLD_PALE}
        size={0.05}
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

/* ─── Main Scene ─── */
function PortalScene() {
  return (
    <>
      <GatePillar side="left" />
      <GatePillar side="right" />
      <GateArch />
      <GateGlow />
      <RisingEmbers count={20} />
    </>
  );
}

/* ─── Exported Canvas Component ─── */
export interface PortalExperienceProps {
  className?: string;
}

export function PortalExperience({ className = '' }: PortalExperienceProps) {
  return (
    <div className={`portal-experience ${className}`} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 1.2, 4], fov: 38 }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[2, 4, 3]} intensity={0.8} color={new Color('#ffd596')} />
        <pointLight position={[0, 1, 0]} intensity={0.7} color={new Color(GOLD)} distance={6} />
        <PortalScene />
      </Canvas>
    </div>
  );
}

export default PortalExperience;
