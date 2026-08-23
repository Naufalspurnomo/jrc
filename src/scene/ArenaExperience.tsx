import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  CylinderGeometry,
  TorusGeometry,
  SphereGeometry,
  BoxGeometry,
  Color,
  Group,
  MeshStandardMaterial,
  Mesh,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  Vector3,
} from 'three';

/* ─── Color palette ─── */
const GOLD = '#d7a63b';
const GOLD_PALE = '#f2cc74';
const OXBLOOD = '#601c1e';
const COAL = '#100c0b';
const TRAVERTINE = '#e8d7b8';

/* ─── Reusable materials ─── */
function goldMat(opts?: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]>) {
  return new MeshStandardMaterial({
    color: new Color(GOLD),
    roughness: 0.35,
    metalness: 0.7,
    ...opts,
  });
}

function stoneMat(opts?: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]>) {
  return new MeshStandardMaterial({
    color: new Color(TRAVERTINE),
    roughness: 0.85,
    metalness: 0.05,
    ...opts,
  });
}

function darkMat(opts?: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]>) {
  return new MeshStandardMaterial({
    color: new Color(COAL),
    roughness: 0.9,
    metalness: 0,
    ...opts,
  });
}

/* ─── Arena Floor ─── */
function ArenaFloor() {
  return (
    <group position={[0, -0.6, 0]}>
      {/* Main octagonal floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.2, 3.4, 0.15, 8]} />
        <meshStandardMaterial color={new Color('#c9a06a')} roughness={0.92} metalness={0.02} />
      </mesh>
      {/* Inner circle (arena sand) */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 0.02, 32]} />
        <meshStandardMaterial color={new Color('#b8944f')} roughness={0.95} metalness={0} />
      </mesh>
      {/* Gold rim */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.3, 0.06, 8, 64]} />
        {goldMat()}
      </mesh>
      {/* Inner rim */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.6, 0.04, 8, 64]} />
        {goldMat({ opacity: 0.6, transparent: true })}
      </mesh>
    </group>
  );
}

/* ─── Column ─── */
function Column({ position, height = 2.4 }: { position: [number, number, number]; height?: number }) {
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, -height / 2 + 0.08, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.16, 12]} />
        {stoneMat()}
      </mesh>
      {/* Shaft */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.1, height - 0.4, 12]} />
        {stoneMat({ color: new Color('#ddd0b8') })}
      </mesh>
      {/* Capital */}
      <mesh position={[0, height / 2 - 0.08, 0]}>
        <cylinderGeometry args={[0.16, 0.08, 0.16, 12]} />
        {stoneMat()}
      </mesh>
      {/* Gold band */}
      <mesh position={[0, height * 0.15, 0]}>
        <torusGeometry args={[0.1, 0.015, 8, 16]} />
        {goldMat({ opacity: 0.8, transparent: true })}
      </mesh>
    </group>
  );
}

/* ─── Arch (between two points) ─── */
function Arch({ from, to }: { from: Vector3; to: Vector3 }) {
  const mid = new Vector3().addVectors(from, to).multiplyScalar(0.5);
  const span = from.distanceTo(to);
  const angle = Math.atan2(to.z - from.z, to.x - from.x);

  return (
    <group position={[mid.x, mid.y + 0.6, mid.z]} rotation={[0, -angle, 0]}>
      <mesh>
        <boxGeometry args={[span, 0.08, 0.12]} />
        {stoneMat()}
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[span * 0.6, 0.06, 0.14]} />
        {goldMat({ opacity: 0.5, transparent: true })}
      </mesh>
    </group>
  );
}

/* ─── Colosseum Ring ─── */
function ColosseumRing() {
  const columns = useMemo(() => {
    const count = 8;
    const radius = 3.3;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return {
        pos: [Math.cos(angle) * radius, 0.6, Math.sin(angle) * radius] as [number, number, number],
        angle,
      };
    });
  }, []);

  const arches = useMemo(() => {
    return columns.map((col, i) => {
      const next = columns[(i + 1) % columns.length];
      return { from: new Vector3(...col.pos), to: new Vector3(...next.pos), key: i };
    });
  }, [columns]);

  return (
    <group>
      {columns.map((col, i) => (
        <Column key={i} position={col.pos} height={2.0 + (i % 2) * 0.3} />
      ))}
      {arches.map(({ from, to, key }) => (
        <Arch key={key} from={from} to={to} />
      ))}
    </group>
  );
}

/* ─── Floating Shield ─── */
function FloatingShield({ position }: { position: [number, number, number] }) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.3;
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.8) * 0.12;
  });

  return (
    <group ref={ref} position={position}>
      {/* Shield disc */}
      <mesh>
        <cylinderGeometry args={[0.45, 0.45, 0.06, 32]} />
        {goldMat()}
      </mesh>
      {/* Shield rim */}
      <mesh>
        <torusGeometry args={[0.45, 0.035, 8, 32]} />
        {goldMat({ color: new Color(GOLD_PALE), roughness: 0.25, metalness: 0.8 })}
      </mesh>
      {/* Center boss */}
      <mesh position={[0, 0.04, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        {goldMat({ color: new Color(GOLD_PALE), roughness: 0.2, metalness: 0.85 })}
      </mesh>
      {/* Decorative rings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.012, 6, 24]} />
        {goldMat({ opacity: 0.4, transparent: true })}
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.01, 6, 24]} />
        {goldMat({ opacity: 0.3, transparent: true })}
      </mesh>
    </group>
  );
}

/* ─── Floating Particles ─── */
function FloatingParticles({ count = 40 }: { count?: number }) {
  const ref = useRef<Points>(null);

  const { geometry, speeds } = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const s = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 3;
      pos[s] = Math.cos(theta) * r;
      pos[s + 1] = Math.random() * 3 - 0.5;
      pos[s + 2] = Math.sin(theta) * r;
      spd[i] = 0.1 + Math.random() * 0.25;
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
      arr[s + 1] += speeds[i] * delta * 0.5;
      if (arr[s + 1] > 3.5) {
        arr[s + 1] = -0.5;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color={GOLD}
        size={0.04}
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

/* ─── Ambient glow orbs ─── */
function GlowOrbs() {
  const orbs = useMemo(
    () =>
      [
        { pos: [-2, 1.5, -1] as [number, number, number], color: '#c99a3a', scale: 0.3 },
        { pos: [2.5, 0.8, -1.5] as [number, number, number], color: '#8c2928', scale: 0.25 },
        { pos: [0, 2.2, -2] as [number, number, number], color: '#d7a63b', scale: 0.2 },
      ] as const,
    [],
  );

  return (
    <>
      {orbs.map((orb, i) => (
        <mesh key={i} position={orb.pos}>
          <sphereGeometry args={[orb.scale, 16, 16]} />
          <meshStandardMaterial
            color={new Color(orb.color)}
            emissive={new Color(orb.color)}
            emissiveIntensity={0.8}
            transparent
            opacity={0.25}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

/* ─── Main Scene ─── */
function ArenaScene() {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
  });

  return (
    <group ref={groupRef}>
      <ArenaFloor />
      <ColosseumRing />
      <FloatingShield position={[0, 1.8, 0]} />
      <FloatingParticles count={35} />
      <GlowOrbs />
    </group>
  );
}

/* ─── Exported Canvas Component ─── */
export interface ArenaExperienceProps {
  className?: string;
}

export function ArenaExperience({ className = '' }: ArenaExperienceProps) {
  return (
    <div className={`arena-experience ${className}`} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 2.5, 5.5], fov: 42 }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 4]} intensity={0.9} color={new Color('#ffd596')} />
        <directionalLight position={[-2, 3, -2]} intensity={0.3} color={new Color('#c99a3a')} />
        <pointLight position={[0, 2, 0]} intensity={0.6} color={new Color('#d7a63b')} distance={8} />
        <ArenaScene />
      </Canvas>
    </div>
  );
}

export default ArenaExperience;
