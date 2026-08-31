import { useEffect, useRef, useState, type RefObject } from 'react';

import type {
  CinematicMotionController,
  createCinematicMotionController,
} from './cinematicMotionRuntime';

type CinematicMotionRuntime = {
  createCinematicMotionController: typeof createCinematicMotionController;
};

type LoadCinematicMotionRuntime = () => Promise<CinematicMotionRuntime>;

const loadCinematicMotionRuntime: LoadCinematicMotionRuntime = () => import('./cinematicMotionRuntime');

function isStaticMotionEnvironment() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || window.innerWidth < 768
    || navigator.maxTouchPoints > 0
  );
}

interface UseCinematicMotionOptions {
  disabled?: boolean;
  loadRuntime?: LoadCinematicMotionRuntime;
}

interface CinematicMotionResult<T extends HTMLElement> {
  rootRef: RefObject<T | null>;
  sceneActive: boolean;
  reducedMotion: boolean;
}

/**
 * Lazily owns the single Lenis/GSAP bridge for the public cinematic experience.
 * Disabled and static scenes never request the heavyweight motion runtime.
 */
export function useCinematicMotion<T extends HTMLElement>({
  disabled = false,
  loadRuntime = loadCinematicMotionRuntime,
}: UseCinematicMotionOptions = {}): CinematicMotionResult<T> {
  const rootRef = useRef<T>(null);
  const [reducedMotion, setReducedMotion] = useState(() => isStaticMotionEnvironment());
  const [sceneActive, setSceneActive] = useState(() => !disabled && !isStaticMotionEnvironment());

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotionPreference = () => setReducedMotion(
      media.matches || window.innerWidth < 768 || navigator.maxTouchPoints > 0,
    );
    syncMotionPreference();
    media.addEventListener('change', syncMotionPreference);
    return () => media.removeEventListener('change', syncMotionPreference);
  }, []);

  useEffect(() => {
    if (disabled || reducedMotion) {
      setSceneActive(false);
      return undefined;
    }

    let cancelled = false;
    let controller: CinematicMotionController | null = null;
    let observer: IntersectionObserver | null = null;
    const root = rootRef.current;
    const onVisibilityChange = () => {
      controller?.setDocumentVisible(document.visibilityState === 'visible');
    };

    void loadRuntime()
      .then((runtime) => {
        if (cancelled) return;

        controller = runtime.createCinematicMotionController({
          onSceneActivityChange: setSceneActive,
        });
        observer = root
          ? new IntersectionObserver(
              ([entry]) => controller?.setHeroVisible(entry.isIntersecting),
              { rootMargin: '120px 0px', threshold: 0.01 },
            )
          : null;
        if (root) observer?.observe(root);
        document.addEventListener('visibilitychange', onVisibilityChange);
        onVisibilityChange();
      })
      .catch(() => {
        if (!cancelled) setSceneActive(false);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      controller?.destroy();
    };
  }, [disabled, loadRuntime, reducedMotion]);

  return {
    rootRef,
    sceneActive,
    reducedMotion,
  };
}

export default useCinematicMotion;
