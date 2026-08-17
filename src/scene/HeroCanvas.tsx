import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';

import { HERO_ASSETS, type HeroCanvasProps } from './HeroExperience';

const HEAT_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HEAT_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  varying vec2 vUv;
  void main() {
    float edge = smoothstep(0.0, .18, vUv.x) * smoothstep(0.0, .18, 1.0 - vUv.x);
    float lift = smoothstep(0.0, .2, vUv.y) * smoothstep(0.0, .3, 1.0 - vUv.y);
    float wave = sin((vUv.x * 18.0) + uTime * 1.7 + sin(vUv.y * 9.0)) * .5 + .5;
    vec3 warm = mix(vec3(.62, .16, .035), vec3(1.0, .68, .22), wave);
    gl_FragColor = vec4(warm, edge * lift * (.025 + wave * .055) * uEnergy);
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float horizontal = smoothstep(0.0, .3, vUv.x) * smoothstep(0.0, .3, 1.0 - vUv.x);
    float vertical = smoothstep(0.0, .14, vUv.y) * smoothstep(0.0, .3, 1.0 - vUv.y);
    gl_FragColor = vec4(uColor, horizontal * vertical * uOpacity);
  }
`;

function seeded(index: number, offset = 0) {
  const value = Math.sin((index + 1) * 9283.17 + offset * 77.3) * 43758.5453;
  return value - Math.floor(value);
}

function createParticles(count: number, sparks = false) {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    positions[stride] = (seeded(index, 1) - 0.5) * (sparks ? 1.1 : 2.2);
    positions[stride + 1] = seeded(index, 2) * (sparks ? 0.7 : 1.2);
    positions[stride + 2] = seeded(index, 3) * 0.3;
    speeds[index] = (sparks ? 0.38 : 0.1) + seeded(index, 4) * (sparks ? 0.4 : 0.14);
  }
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  return { geometry, speeds };
}

function coverScale(width: number, height: number, aspect: number) {
  if (width / height > aspect) return [width, width / aspect] as const;
  return [height * aspect, height] as const;
}

interface ArenaSceneProps {
  activeRef: React.RefObject<boolean>;
  onFirstFrame?: () => void;
}

function ArenaScene({ activeRef, onFirstFrame }: ArenaSceneProps) {
  const viewport = useThree((state) => state.viewport);
  const renderWidth = useThree((state) => state.size.width);
  const mobile = renderWidth < 720;
  const [background, backgroundDepth, foreground, foregroundDepth] = useLoader(
    TextureLoader,
    [
      mobile ? HERO_ASSETS.backgroundMobile : HERO_ASSETS.background,
      HERO_ASSETS.backgroundDepth,
      HERO_ASSETS.foreground,
      HERO_ASSETS.foregroundDepth,
    ],
  ) as Texture[];
  background.colorSpace = SRGBColorSpace;
  foreground.colorSpace = SRGBColorSpace;

  const backgroundGroup = useRef<Group>(null);
  const foregroundGroup = useRef<Group>(null);
  const atmosphereRef = useRef<Group>(null);
  const dustRef = useRef<Points>(null);
  const sparksRef = useRef<Points>(null);
  const heatRef = useRef<ShaderMaterial>(null);
  const shieldRef = useRef<Mesh>(null);
  const impactRef = useRef<Mesh>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const scrollRef = useRef(0);
  const hasReportedFirstFrame = useRef(false);

  const dust = useMemo(() => createParticles(64), []);
  const sparks = useMemo(() => createParticles(28, true), []);
  const backgroundSize = coverScale(
    viewport.width,
    viewport.height,
    mobile ? 1440 / 1920 : 16 / 9,
  );
  const referenceHeight = viewport.height * (mobile ? 0.92 : 1.1455);
  const foregroundSize = [referenceHeight * (1440 / 1173), referenceHeight] as const;
  const foregroundY = mobile
    ? -viewport.height / 2 + foregroundSize[1] / 2 - viewport.height * 0.07
    : 0;
  const foregroundX = viewport.width * (mobile ? -0.36 : 0.035);

  useFrame((state, delta) => {
    if (!hasReportedFirstFrame.current) {
      hasReportedFirstFrame.current = true;
      onFirstFrame?.();
    }
    if (!activeRef.current) return;
    const dt = Math.min(delta, 0.05);
    pointerRef.current.x += (state.pointer.x - pointerRef.current.x) * (1 - Math.exp(-dt * 4));
    pointerRef.current.y += (state.pointer.y - pointerRef.current.y) * (1 - Math.exp(-dt * 4));
    scrollRef.current +=
      (Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1) - scrollRef.current) *
      (1 - Math.exp(-dt * 3));

    if (backgroundGroup.current) {
      backgroundGroup.current.position.x = pointerRef.current.x * 0.028;
      backgroundGroup.current.position.y = pointerRef.current.y * 0.014 - scrollRef.current * 0.08;
    }
    if (foregroundGroup.current) {
      foregroundGroup.current.position.x = foregroundX + pointerRef.current.x * -0.055;
      foregroundGroup.current.position.y =
        foregroundY + pointerRef.current.y * -0.025 - scrollRef.current * 0.04;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.position.x = pointerRef.current.x * 0.09;
      atmosphereRef.current.position.y = -scrollRef.current * 0.18;
    }

    const animateParticles = (
      points: Points | null,
      speeds: Float32Array,
      ceiling: number,
      wind: number,
    ) => {
      if (!points) return;
      const attribute = points.geometry.getAttribute('position') as BufferAttribute;
      const positions = attribute.array as Float32Array;
      for (let index = 0; index < speeds.length; index += 1) {
        const stride = index * 3;
        positions[stride] += (wind + pointerRef.current.x * 0.018) * dt;
        positions[stride + 1] += speeds[index] * dt * (1 + scrollRef.current * 1.8);
        if (positions[stride + 1] > ceiling) {
          positions[stride] = (seeded(index, state.clock.elapsedTime) - 0.5) * ceiling;
          positions[stride + 1] = 0;
        }
      }
      attribute.needsUpdate = true;
    };

    animateParticles(dustRef.current, dust.speeds, 1.25, -0.025);
    animateParticles(sparksRef.current, sparks.speeds, 0.85, 0.03);

    if (heatRef.current) {
      heatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      heatRef.current.uniforms.uEnergy.value = 1 + scrollRef.current * 0.8;
    }

    const shieldDistance = Math.hypot(state.pointer.x - 0.3, state.pointer.y - 0.03);
    const shieldEnergy = Math.max(0, 1 - shieldDistance / 0.7);
    if (shieldRef.current) {
      const material = shieldRef.current.material as MeshBasicMaterial;
      material.opacity += (0.11 + shieldEnergy * 0.24 - material.opacity) * (1 - Math.exp(-dt * 6));
      const scale = 0.72 + shieldEnergy * 0.15;
      shieldRef.current.scale.setScalar(scale);
    }
    if (impactRef.current) {
      const pulse = (state.clock.elapsedTime % 2.8) / 2.8;
      impactRef.current.scale.set(0.65 + pulse * 0.95, 0.24 + pulse * 0.36, 1);
      (impactRef.current.material as MeshBasicMaterial).opacity = (1 - pulse) * 0.14;
    }
  });

  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[-3, 4, 6]} intensity={0.9} color={new Color('#ffd596')} />
      <group ref={backgroundGroup} position={[0, 0, -2]}>
        <mesh scale={[backgroundSize[0], backgroundSize[1], 1]}>
          <planeGeometry args={[1, 1, 64, 36]} />
          <meshStandardMaterial
            map={background}
            displacementMap={backgroundDepth}
            displacementScale={0.045}
            roughness={0.92}
            metalness={0}
          />
        </mesh>
      </group>

      <group ref={atmosphereRef} position={[0, 0, -0.8]}>
        <mesh
          position={[-viewport.width * 0.08, viewport.height * 0.12, 0]}
          rotation={[0, 0, -0.24]}
          scale={[viewport.width * 0.17, viewport.height * 1.2, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            vertexShader={HEAT_VERTEX}
            fragmentShader={ATMOSPHERE_FRAGMENT}
            uniforms={{
              uColor: { value: new Color('#f5c879') },
              uOpacity: { value: mobile ? 0.055 : 0.1 },
            }}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
        <mesh
          position={[viewport.width * 0.13, viewport.height * 0.08, 0.01]}
          rotation={[0, 0, 0.18]}
          scale={[viewport.width * 0.11, viewport.height * 1.05, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            vertexShader={HEAT_VERTEX}
            fragmentShader={ATMOSPHERE_FRAGMENT}
            uniforms={{
              uColor: { value: new Color('#ffe0a0') },
              uOpacity: { value: mobile ? 0.035 : 0.068 },
            }}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
        <mesh
          position={[0, -viewport.height * 0.17, 0.03]}
          scale={[viewport.width * 1.2, viewport.height * 0.18, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            vertexShader={HEAT_VERTEX}
            fragmentShader={ATMOSPHERE_FRAGMENT}
            uniforms={{
              uColor: { value: new Color('#c99860') },
              uOpacity: { value: mobile ? 0.07 : 0.11 },
            }}
            transparent
            depthWrite={false}
          />
        </mesh>
      </group>

      <group
        ref={foregroundGroup}
        position={[foregroundX, foregroundY, 0]}
      >
        <mesh scale={[foregroundSize[0], foregroundSize[1], 1]}>
          <planeGeometry args={[1, 1, 72, 58]} />
          <meshStandardMaterial
            map={foreground}
            displacementMap={foregroundDepth}
            displacementScale={0.022}
            transparent
            alphaTest={0.015}
            roughness={0.82}
          />
        </mesh>
      </group>

      <group position={[viewport.width * 0.235, -viewport.height * 0.43, 1]}>
        <points ref={dustRef} geometry={dust.geometry}>
          <pointsMaterial
            color="#d8ad63"
            size={0.036}
            transparent
            opacity={0.38}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
        <points ref={sparksRef} geometry={sparks.geometry}>
          <pointsMaterial
            color="#f1b33f"
            size={0.028}
            transparent
            opacity={0.82}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>

      <mesh position={[viewport.width * 0.23, -viewport.height * 0.4, 0.86]} scale={[2.6, 0.8, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={heatRef}
          vertexShader={HEAT_VERTEX}
          fragmentShader={HEAT_FRAGMENT}
          uniforms={{ uTime: { value: 0 }, uEnergy: { value: 1 } }}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <mesh ref={impactRef} position={[viewport.width * 0.23, -viewport.height * 0.415, 1.02]}>
        <ringGeometry args={[0.38, 0.42, 64]} />
        <meshBasicMaterial
          color="#e7b247"
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <mesh ref={shieldRef} position={[viewport.width * 0.175, viewport.height * 0.03, 0.9]} scale={0.72}>
        <circleGeometry args={[0.72, 64]} />
        <meshBasicMaterial
          color="#eebd57"
          transparent
          opacity={0.11}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </>
  );
}

function ContextLifecycle({ onError }: Pick<HeroCanvasProps, 'onError'>) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    if (!onError) return undefined;
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onError();
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    return () => canvas.removeEventListener('webglcontextlost', handleContextLost);
  }, [gl, onError]);

  return null;
}

function HeroCanvas({ active, maxDpr = 1.5, onError, onReady }: HeroCanvasProps) {
  const activeRef = useRef(active);
  activeRef.current = active;
  const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1 : maxDpr);

  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10], zoom: 100, near: 0.1, far: 50 }}
      dpr={dpr}
      frameloop={active ? 'always' : 'demand'}
      gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.setClearColor(0x100c0b, 0);
      }}
    >
      <ContextLifecycle onError={onError} />
      <ArenaScene activeRef={activeRef} onFirstFrame={onReady} />
    </Canvas>
  );
}

export default HeroCanvas;
