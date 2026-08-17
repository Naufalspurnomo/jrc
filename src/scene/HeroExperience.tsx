import {
  Component,
  useEffect,
  useState,
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

import { useCinematicMotion } from '../hooks/useCinematicMotion';
import './HeroExperience.css';

export const HERO_ASSETS = {
  background: '/assets/hero-rome-wide.webp',
  backgroundAvif: '/assets/hero-rome-wide.avif',
  backgroundMobile: '/assets/hero-rome-wide-mobile.webp',
  backgroundDepth: '/assets/hero-rome-depth.png',
  foreground: '/assets/batu-knight@2x.webp',
  foregroundFallback: '/assets/batu-knight.png',
  foregroundDepth: '/assets/batu-knight-depth.png',
} as const;

export function hasWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGL2RenderingContext && canvas.getContext('webgl2'),
    );
  } catch {
    return false;
  }
}

export interface HeroCanvasProps {
  active: boolean;
  maxDpr?: number;
  onError?: () => void;
  onReady?: () => void;
}

interface CanvasErrorBoundaryProps extends PropsWithChildren {
  onError: () => void;
}

class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

interface HeroExperienceProps extends PropsWithChildren {
  className?: string;
  forceStatic?: boolean;
}

export function HeroExperience({
  children,
  className = '',
  forceStatic = false,
}: HeroExperienceProps) {
  const { rootRef, sceneActive, reducedMotion } =
    useCinematicMotion<HTMLDivElement>({ disabled: forceStatic });
  const [CanvasLayer, setCanvasLayer] =
    useState<ComponentType<HeroCanvasProps> | null>(null);
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);

  useEffect(() => {
    if (forceStatic || reducedMotion || !hasWebGLSupport()) return undefined;
    let active = true;
    void import('./HeroCanvas')
      .then(({ default: HeroCanvas }) => {
        if (active) setCanvasLayer(() => HeroCanvas);
      })
      .catch(() => {
        if (active) {
          setHasRenderedFrame(false);
          setCanvasLayer(null);
        }
      });
    return () => {
      active = false;
    };
  }, [forceStatic, reducedMotion]);

  const canMountWebGL = Boolean(CanvasLayer) && !forceStatic && !reducedMotion;
  const webglReady = canMountWebGL && hasRenderedFrame;
  const handleCanvasError = () => {
    setHasRenderedFrame(false);
    setCanvasLayer(null);
  };
  return (
    <div
      ref={rootRef}
      className={`scene-hero hero-scene${webglReady ? ' hero-scene--webgl' : ''} ${className}`.trim()}
      data-scene-active={sceneActive ? 'true' : 'false'}
    >
      <div
        className="hero-scene__static"
        data-testid="hero-static-fallback"
        aria-hidden={webglReady ? 'true' : undefined}
      >
        <picture className="hero-scene__background-picture">
          <source media="(max-width: 640px)" srcSet={HERO_ASSETS.backgroundMobile} />
          <source srcSet={HERO_ASSETS.backgroundAvif} type="image/avif" />
          <img
            className="hero-scene__background-image"
            src={HERO_ASSETS.background}
            alt=""
            width="3840"
            height="2160"
            fetchPriority="high"
          />
        </picture>
        <img
          className="hero-scene__foreground-image"
          src={HERO_ASSETS.foreground}
          alt="Ksatria JRC XIV memasuki arena Roma"
          width="2880"
          height="2346"
          fetchPriority="high"
        />
      </div>

      {canMountWebGL && CanvasLayer ? (
        <div
          className="hero-scene__canvas"
          data-testid="hero-webgl-canvas"
          aria-hidden="true"
        >
          <CanvasErrorBoundary onError={handleCanvasError}>
            <CanvasLayer
              active={sceneActive}
              maxDpr={1.5}
              onError={handleCanvasError}
              onReady={() => setHasRenderedFrame(true)}
            />
          </CanvasErrorBoundary>
        </div>
      ) : null}

      <div className="hero-scene__veil" aria-hidden="true" />
      <div className="hero-scene__content">{children}</div>
    </div>
  );
}

export default HeroExperience;
