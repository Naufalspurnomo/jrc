/**
 * ArenaScene — Full Roman Colosseum 3D environment.
 *
 * Built from geometry primitives: arched walls, tiered seating,
 * arena floor, columns, gates, torch fire, dust particles.
 * User can orbit with mouse drag. Desktop-first.
 */
import { useRef, useMemo, useCallback, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  CylinderGeometry,
  BoxGeometry,
  TorusGeometry,
  SphereGeometry,
  BufferAttribute,
  BufferGeometry,
  Points,
  AdditiveBlending,
  Vector3,
  DoubleSide,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';

/* ═══════════════════════════════════════════════════════════════════
   PALETTE
   ═══════════════════════════════════════════════════════════════════ */

const STONE = '#c4a882';
const STONE_DARK = '#8a7560';
const STONE_LIGHT = '#ddd0b8';
const GOLD = '#d7a63b';
const GOLD_BRIGHT = '#f2cc74';
const OXBLOOD = '#601c1e';
const SAND = '#b8944f';
const TORCH = '#ff8c2a';
const EMBER = '#ff6b1a';

/* ═══════════════════════════════════════════════════════════════════
   MATERIALS
   ═══════════════════════════════════════════════════════════════════ */

function stoneMaterial(color = STONE) {
  return new MeshStandardMaterial({
    color: new Color(color),
    roughness: 0.88,
    metalness: 0.03,
  });
}

function goldMaterial() {
  return new MeshStandardMaterial({
    color: new Color(GOLD),
    roughness: 0.3,
    metalness: 0.72,
  });
}

function sandMaterial() {
  return new MeshStandardMaterial({
    color: new Color(SAND),
    roughness: 0.95,
    metalness: 0,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   ARENA FLOOR
   ═══════════════════════════════════════════════════════════════════ */

function ArenaFloor() {
  return (
    <group position={[0, -0.35, 0]}>
      {/* Main sand floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[5.5, 5.5, 0.12, 48]} />
        {sandMaterial()}
      </mesh>
      {/* Gold rim */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[5.5, 0.06, 8, 64]} />
        {goldMaterial()}
      </mesh>
      {/* Inner marking circle */}
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.0, 0.03, 6, 48]} />
        {new MeshStandardMaterial({
          color: new Color(GOLD_BRIGHT),
          roughness: 0.4,
          metalness: 0.5,
          transparent: true,
          opacity: 0.35,
        })}
      </mesh>
      {/* Center cross */}
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.06, 6, 0.01]} />
        {new MeshStandardMaterial({ color: new Color(GOLD), transparent: true, opacity: 0.2 })}
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <boxGeometry args={[0.06, 6, 0.01]} />
        {new MeshStandardMaterial({ color: new Color(GOLD), transparent: true, opacity: 0.2 })}
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COLosseum WALL — single arc segment
   ═══════════════════════════════════════════════════════════════════ */

function ArchUnit({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Left pillar */}
      <mesh position={[-0.42, 0, 0]}>
        <boxGeometry args={[0.18, 1.6, 0.25]} />
        {stoneMaterial(STONE_LIGHT)}
      </mesh>
      {/* Right pillar */}
      <mesh position={[0.42, 0, 0]}>
        <boxGeometry args={[0.18, 1.6, 0.25]} />
        {stoneMaterial(STONE_LIGHT)}
      </mesh>
      {/* Arch top — curved via small boxes */}
      {Array.from({ length: 9 }, (_, i) => {
        const t = (i / 8) * Math.PI;
        const x = Math.cos(t) * 0.42;
        const y = Math.sin(t) * 0.28 + 0.8;
        return (
          <mesh key={i} position={[x, y, 0]}>
            <boxGeometry args={[0.12, 0.1, 0.25]} />
            {stoneMaterial(STONE)}
          </mesh>
        );
      })}
      {/* Arch keystone */}
      <mesh position={[0, 1.08, 0]}>
        <boxGeometry args={[0.14, 0.12, 0.28]} />
        {goldMaterial()}
      </mesh>
      {/* Capital detail */}
      <mesh position={[-0.42, 0.82, 0]}>
        <boxGeometry args={[0.22, 0.06, 0.27]} />
        {stoneMaterial(STONE_DARK)}
      </mesh>
      <mesh position={[0.42, 0.82, 0]}>
        <boxGeometry args={[0.22, 0.06, 0.27]} />
        {stoneMaterial(STONE_DARK)}
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COLOSSEUM RING — two tiers of arches
   ═══════════════════════════════════════════════════════════════════ */

function ColosseumRing() {
  const segments = 24;
  const radius = 5.8;

  const arches = useMemo(() => {
    const result: { pos: [number, number, number]; rot: [number, number, number]; key: string }[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const rotY = -angle + Math.PI / 2;

      /* Lower tier */
      result.push({
        pos: [x, 0.45, z],
        rot: [0, rotY, 0],
        key: `lower-${i}`,
      });
      /* Upper tier — slightly larger radius, taller */
      result.push({
        pos: [Math.cos(angle) * (radius + 0.05), 2.0, Math.sin(angle) * (radius + 0.05)],
        rot: [0, rotY, 0],
        key: `upper-${i}`,
      });
    }
    return result;
  }, []);

  /* Solid wall behind arches */
  const wallSegments = useMemo(() => {
    const result: { pos: [number, number, number]; rot: [number, number, number]; key: string }[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * (radius - 0.15);
      const z = Math.sin(angle) * (radius - 0.15);
      result.push({
        pos: [x, 0.45, z],
        rot: [0, -angle + Math.PI / 2, 0],
        key: `wall-${i}`,
      });
    }
    return result;
  }, []);

  return (
    <group>
      {/* Lower tier arches */}
      {arches.filter(a => a.key.startsWith('lower')).map(a => (
        <ArchUnit key={a.key} position={a.pos} rotation={a.rot} />
      ))}
      {/* Upper tier arches (smaller) */}
      {arches.filter(a => a.key.startsWith('upper')).map(a => (
        <group key={a.key} position={a.pos} rotation={a.rot} scale={[0.85, 0.75, 0.85]}>
          <ArchUnit position={[0, 0, 0]} rotation={[0, 0, 0]} />
        </group>
      ))}
      {/* Cornice / top rim */}
      <mesh position={[0, 2.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius + 0.1, 0.12, 8, 64]} />
        {stoneMaterial(STONE_DARK)}
      </mesh>
      {/* Gold accent rim */}
      <mesh position={[0, 2.92, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius + 0.1, 0.04, 6, 64]} />
        {goldMaterial()}
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ROMAN SHIELD (scutum) — center of arena
   ═══════════════════════════════════════════════════════════════════ */

function RomanShield() {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.15;
    ref.current.position.y = 1.2 + Math.sin(state.clock.elapsedTime * 0.6) * 0.08;
  });

  return (
    <group ref={ref} position={[0, 1.2, 0]}>
      {/* Shield body — curved rectangle approximation */}
      <mesh>
        <cylinderGeometry args={[0.7, 0.8, 0.08, 6]} />
        {new MeshPhysicalMaterial({
          color: new Color(OXBLOOD),
          roughness: 0.35,
          metalness: 0.55,
          clearcoat: 0.3,
          clearcoatRoughness: 0.4,
        })}
      </mesh>
      {/* Shield rim */}
      <mesh>
        <torusGeometry args={[0.75, 0.04, 8, 32]} />
        {goldMaterial()}
      </mesh>
      {/* Center boss (umbo) */}
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {new MeshPhysicalMaterial({
          color: new Color(GOLD_BRIGHT),
          roughness: 0.2,
          metalness: 0.85,
          clearcoat: 0.5,
        })}
      </mesh>
      {/* Wings decoration — left */}
      <mesh position={[-0.35, 0.05, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.25, 0.025, 0.04]} />
        {goldMaterial()}
      </mesh>
      {/* Wings decoration — right */}
      <mesh position={[0.35, 0.05, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.25, 0.025, 0.04]} />
        {goldMaterial()}
      </mesh>
      {/* SPQR cross */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.5, 0.02, 0.02]} />
        {new MeshStandardMaterial({ color: new Color(GOLD), transparent: true, opacity: 0.6 })}
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.02, 0.5, 0.02]} />
        {new MeshStandardMaterial({ color: new Color(GOLD), transparent: true, opacity: 0.6 })}
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TORCH FIRE — animated glow
   ═══════════════════════════════════════════════════════════════════ */

const FIRE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FIRE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float flame = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
    float flicker = sin(vUv.x * 12.0 + uTime * 6.0) * 0.15 + 0.85;
    float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
    float alpha = flame * edge * flicker * 0.7;
    vec3 col = mix(uColor, vec3(1.0, 0.9, 0.4), vUv.y * 0.6);
    gl_FragColor = vec4(col, alpha);
  }
`;

function TorchFire({ position }: { position: [number, number, number] }) {
  const matRef = useRef<ShaderMaterial>(null);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group position={position}>
      {/* Torch bracket */}
      <mesh>
        <cylinderGeometry args={[0.03, 0.04, 0.3, 6]} />
        {stoneMaterial(STONE_DARK)}
      </mesh>
      {/* Fire plane */}
      <mesh position={[0, 0.25, 0]}>
        <planeGeometry args={[0.15, 0.25]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={FIRE_VERTEX}
          fragmentShader={FIRE_FRAGMENT}
          uniforms={{
            uTime: { value: 0 },
            uColor: { value: new Color(TORCH) },
          }}
          transparent
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Point light */}
      <pointLight color={new Color(TORCH)} intensity={0.8} distance={3} position={[0, 0.3, 0]} />
    </group>
  );
}

function TorchRing() {
  const count = 8;
  const radius = 5.6;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return (
          <TorchFire
            key={i}
            position={[
              Math.cos(angle) * radius,
              1.5,
              Math.sin(angle) * radius,
            ]}
          />
        );
      })}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DUST PARTICLES
   ═══════════════════════════════════════════════════════════════════ */

function DustParticles({ count = 60 }: { count?: number }) {
  const ref = useRef<Points>(null);

  const { geometry, speeds } = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const s = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * 5;
      pos[s] = Math.cos(theta) * r;
      pos[s + 1] = Math.random() * 4 - 0.5;
      pos[s + 2] = Math.sin(theta) * r;
      spd[i] = 0.03 + Math.random() * 0.08;
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    return { geometry: geo, speeds: spd };
  }, [count]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const attr = ref.current.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < speeds.length; i++) {
      const s = i * 3;
      arr[s] += Math.sin(t * 0.3 + i * 0.7) * delta * 0.02;
      arr[s + 1] += speeds[i] * delta;
      if (arr[s + 1] > 4) arr[s + 1] = -0.5;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color={GOLD_BRIGHT}
        size={0.04}
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   GATE ENTRANCE — large Roman gate
   ═══════════════════════════════════════════════════════════════════ */

function GateEntrance() {
  return (
    <group position={[0, 0, -5.8]}>
      {/* Left pillar */}
      <mesh position={[-1.2, 1, 0]}>
        <boxGeometry args={[0.5, 2.5, 0.5]} />
        {stoneMaterial(STONE_LIGHT)}
      </mesh>
      {/* Right pillar */}
      <mesh position={[1.2, 1, 0]}>
        <boxGeometry args={[0.5, 2.5, 0.5]} />
        {stoneMaterial(STONE_LIGHT)}
      </mesh>
      {/* Lintel */}
      <mesh position={[0, 2.4, 0]}>
        <boxGeometry args={[3.0, 0.3, 0.5]} />
        {stoneMaterial(STONE)}
      </mesh>
      {/* Gold inscription bar */}
      <mesh position={[0, 2.65, 0.01]}>
        <boxGeometry args={[2.6, 0.1, 0.52]} />
        {goldMaterial()}
      </mesh>
      {/* Pediment triangle */}
      <mesh position={[0, 3.0, 0]}>
        <boxGeometry args={[3.4, 0.15, 0.4]} />
        {stoneMaterial(STONE_DARK)}
      </mesh>
      {/* Gate opening glow */}
      <mesh position={[0, 0.8, -0.1]}>
        <planeGeometry args={[2.0, 2.0]} />
        <meshStandardMaterial
          color={new Color(TORCH)}
          emissive={new Color(TORCH)}
          emissiveIntensity={0.3}
          transparent
          opacity={0.06}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN SCENE
   ═══════════════════════════════════════════════════════════════════ */

function ColosseumScene() {
  return (
    <>
      <ArenaFloor />
      <ColosseumRing />
      <RomanShield />
      <TorchRing />
      <GateEntrance />
      <DustParticles count={50} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORTED CANVAS
   ═══════════════════════════════════════════════════════════════════ */

export interface ArenaSceneProps {
  className?: string;
}

export function ArenaScene({ className = '' }: ArenaSceneProps) {
  return (
    <div className={`arena-scene ${className}`} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [6, 4, 6], fov: 40, near: 0.1, far: 100 }}
        dpr={Math.min(window.devicePixelRatio, 2)}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x0a0706, 0);
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.25} color={new Color('#ffeedd')} />
        <directionalLight
          position={[8, 10, 5]}
          intensity={1.2}
          color={new Color('#ffd596')}
         
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight
          position={[-5, 6, -3]}
          intensity={0.3}
          color={new Color('#c99a3a')}
        />
        <pointLight position={[0, 3, 0]} intensity={0.5} color={new Color(GOLD)} distance={12} />

        {/* Fog for depth */}
        <fog attach="fog" args={[new Color('#0a0706'), 8, 25]} />

        {/* Scene */}
        <ColosseumScene />

        {/* Orbit controls — drag to rotate */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.45}
          minAzimuthAngle={-Math.PI * 0.3}
          maxAzimuthAngle={Math.PI * 0.3}
          autoRotate
          autoRotateSpeed={0.3}
          dampingFactor={0.05}
          enableDamping
        />
      </Canvas>
    </div>
  );
}

export default ArenaScene;
