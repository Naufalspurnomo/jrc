import { useEffect, useRef, useState, type PropsWithChildren } from 'react';

import { useCinematicMotion } from '../../hooks/useCinematicMotion';
import { HERO_ASSETS } from './assets';
import './HeroExperience.css';

export { HERO_ASSETS } from './assets';

interface HeroExperienceProps extends PropsWithChildren {
  className?: string;
  forceStatic?: boolean;
  startVideo?: boolean;
}

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

export function HeroExperience({ children, className = '', forceStatic = false, startVideo = true }: HeroExperienceProps) {
  const { rootRef, sceneActive } = useCinematicMotion<HTMLDivElement>({
    disabled: forceStatic || !startVideo,
  });
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const compactViewport = window.matchMedia('(max-width: 640px)').matches;
  const backgroundSource = compactViewport ? HERO_ASSETS.backgroundMobile : HERO_ASSETS.background;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = (navigator as NavigatorWithConnection).connection?.saveData === true;
  const renderVideo = !forceStatic && !reducedMotion && !saveData && !videoFailed && startVideo;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const root = rootRef.current;
    const setVideoVisible = (visible: boolean) => {
      if (visible) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    };
    const observer = root && 'IntersectionObserver' in window
      ? new IntersectionObserver(
          ([entry]) => setVideoVisible(entry.isIntersecting),
          { rootMargin: '120px 0px', threshold: 0.01 },
        )
      : null;

    if (observer && root) {
      observer.observe(root);
    } else {
      setVideoVisible(true);
    }

    return () => {
      observer?.disconnect();
      video.pause();
    };
  }, [renderVideo, rootRef]);

  return (
    <div ref={rootRef} className={`scene-hero hero-scene ${className}`.trim()} data-scene-active={sceneActive ? 'true' : 'false'}>
      <div className="hero-scene__static">
        <picture className="hero-scene__background-picture">
          {!compactViewport ? <source srcSet={HERO_ASSETS.backgroundAvif} type="image/avif" /> : null}
          <img className="hero-scene__background-image" src={backgroundSource} alt="" width="3840" height="2160" fetchPriority="high" />
        </picture>
        <div className="hero-scene__foreground-picture" data-video-ready={videoReady && renderVideo ? 'true' : 'false'}>
          <picture className="hero-scene__foreground-fallback">
            <source media="(max-width: 640px)" srcSet={HERO_ASSETS.foregroundSmall} type="image/webp" />
            <source srcSet={HERO_ASSETS.foreground} type="image/webp" />
            <img className="hero-scene__foreground-image" src={HERO_ASSETS.foregroundFallback} alt="Maskot robot gladiator JRC XIV di arena Roma" width="553" height="1202" fetchPriority="high" decoding="async" />
          </picture>
          {renderVideo ? (
            <video
              ref={videoRef}
              className="hero-scene__foreground-video"
              src={HERO_ASSETS.foregroundVideo}
              muted
              autoPlay
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              onLoadedData={() => setVideoReady(true)}
              onError={() => {
                setVideoReady(false);
                setVideoFailed(true);
              }}
            />
          ) : null}
        </div>
      </div>
      <div className="hero-scene__veil" aria-hidden="true" />
      <div className="hero-scene__content">{children}</div>
    </div>
  );
}

export default HeroExperience;
