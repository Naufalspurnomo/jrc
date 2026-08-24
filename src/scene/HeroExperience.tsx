import type { PropsWithChildren } from 'react';

import { useCinematicMotion } from '../hooks/useCinematicMotion';
import { HERO_ASSETS } from './heroRuntime';
import './HeroExperience.css';

export { HERO_ASSETS } from './heroRuntime';

export function hasWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

interface HeroExperienceProps extends PropsWithChildren {
  className?: string;
  forceStatic?: boolean;
}

export function HeroExperience({ children, className = '', forceStatic = false }: HeroExperienceProps) {
  const { rootRef, sceneActive } = useCinematicMotion<HTMLDivElement>({ disabled: forceStatic });
  const touchDevice = navigator.maxTouchPoints > 0
    || window.matchMedia('(pointer: coarse), (any-pointer: coarse)').matches;
  const backgroundSource = touchDevice ? HERO_ASSETS.backgroundMobile : HERO_ASSETS.background;
  return (
    <div ref={rootRef} className={`scene-hero hero-scene ${className}`.trim()} data-scene-active={sceneActive ? 'true' : 'false'}>
      <div className="hero-scene__static" data-testid="hero-static-fallback">
        <picture className="hero-scene__background-picture">
          {!touchDevice ? <source srcSet={HERO_ASSETS.backgroundAvif} type="image/avif" /> : null}
          <img className="hero-scene__background-image" src={backgroundSource} alt="" width="3840" height="2160" fetchPriority="high" />
        </picture>
        <div className="hero-scene__foreground-picture" data-video-ready="false">
          <picture className="hero-scene__foreground-fallback">
            <source srcSet={HERO_ASSETS.foreground} type="image/webp" />
            <img className="hero-scene__foreground-image" src={HERO_ASSETS.foregroundFallback} alt="Maskot robot gladiator JRC XIV di arena Roma" width="553" height="1202" fetchPriority="high" decoding="async" />
          </picture>
        </div>
      </div>
      <div className="hero-scene__veil" aria-hidden="true" />
      <div className="hero-scene__content">{children}</div>
    </div>
  );
}

export default HeroExperience;
