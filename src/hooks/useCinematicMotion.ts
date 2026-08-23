import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef, useState, type RefObject } from 'react';

gsap.registerPlugin(ScrollTrigger);

type LenisLike = Pick<Lenis, 'raf' | 'on' | 'off' | 'start' | 'stop' | 'destroy'>;

interface TickerLike {
  add(callback: (time: number) => void): void;
  remove(callback: (time: number) => void): void;
  lagSmoothing(threshold: number): void;
}

interface ScrollTriggerLike {
  update(): void;
  refresh(): void;
}

export interface CinematicMotionDependencies {
  createLenis(): LenisLike;
  ticker: TickerLike;
  scrollTrigger: ScrollTriggerLike;
}

export interface CinematicMotionController {
  setDocumentVisible(visible: boolean): void;
  setHeroVisible(visible: boolean): void;
  destroy(): void;
}

interface ControllerOptions {
  dependencies?: CinematicMotionDependencies;
  reducedMotion?: boolean;
  onSceneActivityChange?: (active: boolean) => void;
}

const defaultDependencies: CinematicMotionDependencies = {
  createLenis: () =>
    new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.88,
      touchMultiplier: 1,
    }),
  ticker: gsap.ticker,
  scrollTrigger: ScrollTrigger,
};

export function createCinematicMotionController({
  dependencies = defaultDependencies,
  reducedMotion = false,
  onSceneActivityChange,
}: ControllerOptions = {}): CinematicMotionController {
  if (reducedMotion) {
    onSceneActivityChange?.(false);
    return {
      setDocumentVisible: () => undefined,
      setHeroVisible: () => undefined,
      destroy: () => undefined,
    };
  }

  const lenis = dependencies.createLenis();
  let documentVisible = true;
  let heroVisible = true;
  let destroyed = false;

  const publishSceneActivity = () => {
    onSceneActivityChange?.(documentVisible && heroVisible);
  };
  const onScroll = () => dependencies.scrollTrigger.update();
  const tick = (time: number) => {
    if (!destroyed && documentVisible) lenis.raf(time * 1000);
  };

  lenis.on('scroll', onScroll);
  dependencies.ticker.lagSmoothing(0);
  dependencies.ticker.add(tick);
  dependencies.scrollTrigger.refresh();
  publishSceneActivity();

  return {
    setDocumentVisible(visible) {
      if (destroyed || documentVisible === visible) return;
      documentVisible = visible;
      if (documentVisible) lenis.start();
      else lenis.stop();
      publishSceneActivity();
    },
    setHeroVisible(visible) {
      if (destroyed || heroVisible === visible) return;
      heroVisible = visible;
      publishSceneActivity();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      dependencies.ticker.remove(tick);
      lenis.off('scroll', onScroll);
      lenis.destroy();
    },
  };
}

interface UseCinematicMotionOptions {
  disabled?: boolean;
}

interface CinematicMotionResult<T extends HTMLElement> {
  rootRef: RefObject<T | null>;
  sceneActive: boolean;
  reducedMotion: boolean;
}

/**
 * Owns the single Lenis/GSAP bridge for the public cinematic experience.
 * The scene is paused offscreen without stopping page scrolling.
 */
export function useCinematicMotion<T extends HTMLElement>({
  disabled = false,
}: UseCinematicMotionOptions = {}): CinematicMotionResult<T> {
  const rootRef = useRef<T>(null);
  const [sceneActive, setSceneActive] = useState(!disabled);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const useNativeMotion = media.matches || window.innerWidth < 768 || navigator.maxTouchPoints > 0;
    reducedMotionRef.current = useNativeMotion;
    if (disabled || useNativeMotion) {
      setSceneActive(false);
      return undefined;
    }

    const controller = createCinematicMotionController({
      onSceneActivityChange: setSceneActive,
    });
    const root = rootRef.current;
    const observer = root
      ? new IntersectionObserver(
          ([entry]) => controller.setHeroVisible(entry.isIntersecting),
          { rootMargin: '120px 0px', threshold: 0.01 },
        )
      : null;
    if (root) observer?.observe(root);

    const onVisibilityChange = () =>
      controller.setDocumentVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange();

    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      controller.destroy();
    };
  }, [disabled]);

  return {
    rootRef,
    sceneActive,
    reducedMotion: reducedMotionRef.current,
  };
}

export default useCinematicMotion;
