import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  IcosahedronGeometry,
  OctahedronGeometry,
  TorusKnotGeometry,
  TorusGeometry,
  BoxGeometry,
  CylinderGeometry,
  ConeGeometry,
  SphereGeometry,
  RingGeometry,
  Vector2,
  BufferAttribute,
  BufferGeometry,
  Points,
  AdditiveBlending,
} from 'three';
import { competitions, type Competition } from '../../content/jrc';

/* ═══════════════════════════════════════════════════════════════════
   3D THUMBNAIL SCENES — one per competition category
   ═══════════════════════════════════════════════════════════════════ */

const PALETTE: Record<string, { main: string; accent: string; glow: string }> = {
  gold: { main: '#d7a63b', accent: '#f2cc74', glow: '#c99a3a' },
  crimson: { main: '#c0473a', accent: '#e85d50', glow: '#8c2928' },
  blue: { main: '#3d7fb5', accent: '#5ea8d8', glow: '#24527a' },
};

/* Per-competition 3D scene configs */
const SCENE_CONFIGS: Record<string, {
  geometry: 'torusKnot' | 'icosahedron' | 'octahedron' | 'torus' | 'cone' | 'cylinder' | 'box' | 'sphere' | 'ring';
  colorKey: string;
  scale: number;
  rotSpeed: number;
  float: boolean;
  particles: boolean;
}> = {
  'donatopia-transporter': { geometry: 'torus', colorKey: 'gold', scale: 1.1, rotSpeed: 0.4, float: true, particles: true },
  'nightmaze-rescue-transporter': { geometry: 'octahedron', colorKey: 'blue', scale: 1.2, rotSpeed: 0.35, float: true, particles: false },
  'pirate-clash-transporter-shooter': { geometry: 'cone', colorKey: 'crimson', scale: 1.0, rotSpeed: 0.5, float: false, particles: true },
  'wacky-rally-line-follower-mikro': { geometry: 'torusKnot', colorKey: 'gold', scale: 0.9, rotSpeed: 0.6, float: true, particles: false },
  'ring-rumble-sumo': { geometry: 'icosahedron', colorKey: 'crimson', scale: 1.3, rotSpeed: 0.25, float: true, particles: true },
  'goal-rush-soccer': { geometry: 'sphere', colorKey: 'blue', scale: 1.0, rotSpeed: 0.45, float: true, particles: false },
};

/* ─── Mouse-reactive3D thumbnail ─── */
function ThumbScene({ slug, mouse }: { slug: string; mouse: Vector2 }) {
  const config = SCENE_CONFIGS[slug] || SCENE_CONFIGS['donatopia-transporter'];
  const palette = PALETTE[paletteKey(slug)];
  const ref = useRef<Group>(null);
  const { viewport } = useThree();

  const geo = useMemo(() => {
    const s = config.scale;
    switch (config.geometry) {
      case 'torusKnot': return new TorusKnotGeometry(0.5 * s, 0.18 * s, 64, 12, 2, 3);
      case 'icosahedron': return new IcosahedronGeometry(0.6 * s, 0);
      case 'octahedron': return new OctahedronGeometry(0.6 * s, 0);
      case 'torus': return new TorusGeometry(0.5 * s, 0.18 * s, 16, 32);
      case 'cone': return new ConeGeometry(0.45 * s, 0.9 * s, 6);
      case 'cylinder': return new CylinderGeometry(0.3 * s, 0.5 * s, 0.7 * s, 8);
      case 'box': return new BoxGeometry(0.7 * s, 0.7 * s, 0.7 * s);
      case 'sphere': return new SphereGeometry(0.5 * s, 24, 24);
      case 'ring': return new RingGeometry(0.3 * s, 0.6 * s, 32);
      default: return new IcosahedronGeometry(0.6 * s, 0);
    }
  }, [config.geometry, config.scale]);

  /* Particles */
  const particles = useMemo(() => {
    if (!config.particles) return null;
    const count = 20;
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const s = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 0.5;
      pos[s] = Math.cos(theta) * r;
      pos[s + 1] = (Math.random() - 0.5) * 1.2;
      pos[s + 2] = Math.sin(theta) * r;
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    return geo;
  }, [config.particles]);

  const particleRef = useRef<Points>(null);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;

    /* Rotation */
    ref.current.rotation.y = t * config.rotSpeed;
    ref.current.rotation.x = t * config.rotSpeed * 0.3;

    /* Mouse tilt */
    ref.current.rotation.z += (mouse.x * 0.3 - ref.current.rotation.z) * 0.08;
    ref.current.rotation.x += (-mouse.y * 0.2 - ref.current.rotation.x + t * config.rotSpeed * 0.3) * 0.08;

    /* Float */
    if (config.float) {
      ref.current.position.y = Math.sin(t * 0.8) * 0.1;
    }

    /* Particle drift */
    if (particleRef.current) {
      const attr = particleRef.current.geometry.getAttribute('position') as BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += delta * 0.15;
        if (arr[i + 1] > 1.2) arr[i + 1] = -1.2;
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={0.8} color={new Color('#ffd596')} />
      <pointLight position={[0, 0, 2]} intensity={0.5} color={new Color(palette.main)} distance={6} />

      <group ref={ref}>
        <mesh geometry={geo}>
          <meshStandardMaterial
            color={new Color(palette.main)}
            roughness={0.3}
            metalness={0.65}
            emissive={new Color(palette.glow)}
            emissiveIntensity={0.15}
          />
        </mesh>
        {/* Wireframe overlay */}
        <mesh geometry={geo} scale={1.01}>
          <meshStandardMaterial
            color={new Color(palette.accent)}
            wireframe
            transparent
            opacity={0.12}
          />
        </mesh>
      </group>

      {particles && (
        <points ref={particleRef} geometry={particles}>
          <pointsMaterial
            color={palette.accent}
            size={0.04}
            transparent
            opacity={0.45}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      )}
    </>
  );
}

function paletteKey(slug: string) {
  const comp = competitions.find((c) => c.slug === slug);
  return comp?.accent || 'gold';
}

/* ═══════════════════════════════════════════════════════════════════
   SHOWCASE CARD
   ═══════════════════════════════════════════════════════════════════ */

interface ShowcaseCardProps {
  competition: Competition;
  index: number;
  isActive: boolean;
}

function ShowcaseCard({ competition, index, isActive }: ShowcaseCardProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState(new Vector2(0, 0));

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMouse(new Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    ));
  }, []);

  const accent = PALETTE[competition.accent].main;

  return (
    <article
      className={`showcase-card ${isActive ? 'showcase-card--active' : ''}`}
      style={{ '--sc-accent': accent } as React.CSSProperties}
    >
      <div
        className="showcase-card__canvas"
        ref={canvasRef}
        onMouseMove={handleMouseMove}
      >
        <Canvas
          camera={{ position: [0, 0, 3], fov: 35 }}
          dpr={Math.min(window.devicePixelRatio, 1.5)}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <ThumbScene slug={competition.slug} mouse={mouse} />
        </Canvas>
        <div className="showcase-card__number" aria-hidden="true">
          {competition.romanNumeral}
        </div>
      </div>

      <div className="showcase-card__info">
        <span className="showcase-card__discipline">{competition.discipline}</span>
        <h3 className="showcase-card__name">{competition.shortName}</h3>
        <p className="showcase-card__provocation">"{competition.provocation}"</p>
      </div>

      <div className="showcase-card__border" aria-hidden="true" />
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DRAGGABLE CAROUSEL
   ═══════════════════════════════════════════════════════════════════ */

export function ShowcaseCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  /* Drag handlers */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!trackRef.current) return;
    setIsDragging(true);
    setStartX(e.clientX);
    setScrollLeft(trackRef.current.scrollLeft);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !trackRef.current) return;
    const dx = e.clientX - startX;
    trackRef.current.scrollLeft = scrollLeft - dx;
  }, [isDragging, startX, scrollLeft]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /* Detect active card on scroll */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      const cardWidth = 340;
      const idx = Math.round(track.scrollLeft / cardWidth);
      setActiveIndex(Math.max(0, Math.min(competitions.length - 1, idx)));
    };

    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section id="perlombaan" className="showcase-section" aria-labelledby="showcase-title">
      <div className="site-shell page-shell">
        <header className="showcase-section__header">
          <div>
            <p className="site-kicker kicker">Disciplina VI</p>
            <h2 id="showcase-title">Jelajahi arena.</h2>
            <p className="showcase-section__sub">
              Geser untuk menjelajahi setiap disiplin. Geser ke kanan.
            </p>
          </div>
          <div className="showcase-section__controls">
            <span className="showcase-section__counter" aria-live="polite">
              {String(activeIndex + 1).padStart(2, '0')}
              <i aria-hidden="true" />
              {String(competitions.length).padStart(2, '0')}
            </span>
            <div className="showcase-section__nav">
              <button
                type="button"
                className="showcase-section__arrow"
                aria-label="Sebelumnya"
                disabled={activeIndex === 0}
                onClick={() => {
                  if (!trackRef.current) return;
                  trackRef.current.scrollTo({ left: (activeIndex - 1) * 340, behavior: 'smooth' });
                }}
              >
                ←
              </button>
              <button
                type="button"
                className="showcase-section__arrow"
                aria-label="Berikutnya"
                disabled={activeIndex === competitions.length - 1}
                onClick={() => {
                  if (!trackRef.current) return;
                  trackRef.current.scrollTo({ left: (activeIndex + 1) * 340, behavior: 'smooth' });
                }}
              >
                →
              </button>
            </div>
          </div>
        </header>
      </div>

      <div
        className={`showcase-track ${isDragging ? 'showcase-track--dragging' : ''}`}
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Leading spacer for centered feel */}
        <div className="showcase-track__spacer" aria-hidden="true" />

        {competitions.map((comp, i) => (
          <ShowcaseCard
            key={comp.slug}
            competition={comp}
            index={i}
            isActive={i === activeIndex}
          />
        ))}

        {/* Trailing spacer */}
        <div className="showcase-track__spacer" aria-hidden="true" />
      </div>

      {/* Dot indicators */}
      <div className="showcase-section__dots" role="tablist" aria-label="Pilih arena">
        {competitions.map((comp, i) => (
          <button
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={comp.shortName}
            className="showcase-section__dot"
            data-active={i === activeIndex}
            data-accent={comp.accent}
            key={comp.slug}
            onClick={() => {
              trackRef.current?.scrollTo({ left: i * 340, behavior: 'smooth' });
            }}
          />
        ))}
      </div>
    </section>
  );
}

export default ShowcaseCarousel;
