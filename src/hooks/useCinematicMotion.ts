import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { SCROLL_LOCK_EVENT } from './scrollLock';

gsap.registerPlugin(ScrollTrigger);

type LenisLike = Pick<Lenis, 'raf' | 'on' | 'off' | 'start' | 'stop' | 'scrollTo' | 'destroy'>;

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

const ROUTE_SCROLL_EVENT = 'jrc:route-scroll';

function isStaticMotionEnvironment() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || window.innerWidth < 768
    || navigator.maxTouchPoints > 0
  );
}

const defaultDependencies: CinematicMotionDependencies = {
  createLenis: () =>
    new Lenis({
      lerp: 0.075,
      smoothWheel: true,
      wheelMultiplier: 0.84,
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
  let hashFrame = 0;
  let lastScrollPosition = window.scrollY;

  const publishSceneActivity = () => {
    onSceneActivityChange?.(documentVisible && heroVisible);
  };
  const onScroll = () => {
    const nextScrollPosition = window.scrollY;
    const delta = nextScrollPosition - lastScrollPosition;
    if (Math.abs(delta) > 1.5) {
      document.documentElement.dataset.scrollDirection = delta > 0 ? 'down' : 'up';
    }
    lastScrollPosition = nextScrollPosition;
    dependencies.scrollTrigger.update();
  };
  const onModalLock = (event: Event) => {
    const detail = (event as CustomEvent<{ locked?: boolean; scrollY?: number }>).detail;
    if (detail?.locked === true) {
      lenis.stop();
      return;
    }

    const restoreY = detail?.scrollY;
    if (typeof restoreY === 'number' && Number.isFinite(restoreY)) {
      lenis.scrollTo(restoreY, { immediate: true, force: true });
      lastScrollPosition = restoreY;
      dependencies.scrollTrigger.update();
    }
    if (documentVisible) lenis.start();
  };
  const onRouteScroll = (event: Event) => {
    const targetId = (event as CustomEvent<{ targetId?: string }>).detail?.targetId;
    const target = targetId ? document.getElementById(targetId) : null;
    if (target) lenis.scrollTo(target, { immediate: true, force: true });
  };
  const tick = (time: number) => {
    if (!destroyed && documentVisible) lenis.raf(time * 1000);
  };

  lenis.on('scroll', onScroll);
  window.addEventListener(SCROLL_LOCK_EVENT, onModalLock);
  window.addEventListener(ROUTE_SCROLL_EVENT, onRouteScroll);
  dependencies.ticker.lagSmoothing(0);
  dependencies.ticker.add(tick);
  dependencies.scrollTrigger.refresh();
  if (window.location.hash) {
    hashFrame = window.requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target) lenis.scrollTo(target, { immediate: true, force: true });
    });
  }
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
      window.cancelAnimationFrame(hashFrame);
      dependencies.ticker.remove(tick);
      lenis.off('scroll', onScroll);
      window.removeEventListener(SCROLL_LOCK_EVENT, onModalLock);
      window.removeEventListener(ROUTE_SCROLL_EVENT, onRouteScroll);
      lenis.destroy();
      delete document.documentElement.dataset.scrollDirection;
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
  }, [disabled, reducedMotion]);

  return {
    rootRef,
    sceneActive,
    reducedMotion,
  };
}

export default useCinematicMotion;
