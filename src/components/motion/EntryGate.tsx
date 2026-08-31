import { useEffect, useRef, useState } from 'react';

import './EntryGate.css';

interface EntryGateProps {
  duration?: number;
  reducedMotion?: boolean;
  onComplete?: () => void;
  prepare?: () => Promise<void>;
  prepareTimeout?: number;
  minimumHold?: number;
}

const SESSION_KEY = 'jrc:gate-seen:v3';
const MOBILE_BREAKPOINT = 640;
const DEFAULT_PREPARE_TIMEOUT = 1_800;
const DEFAULT_MINIMUM_HOLD = 300;

export const ENTRY_GATE_ASSETS = {
  heroDesktop: '/assets/hero-rome-wide.avif',
  heroMobile: '/assets/hero-rome-wide-mobile.webp',
  mascotDesktop: '/assets/mascot/jrc14-gladiator-framekey-v2-poster.webp',
  mascotMobile: '/assets/mascot/jrc14-gladiator-poster-mobile-3b151f2ef6.webp',
} as const;

function hasSeenGateThisSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markGateSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* Storage unavailable: the gate may play again on the next load. */
  }
}

export function shouldPlayEntryGate(
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches,
) {
  return !reducedMotion && !hasSeenGateThisSession();
}

export function getEntryGateCriticalAssets(viewportWidth = window.innerWidth) {
  const mobile = viewportWidth <= MOBILE_BREAKPOINT;
  return [
    mobile ? ENTRY_GATE_ASSETS.heroMobile : ENTRY_GATE_ASSETS.heroDesktop,
    mobile ? ENTRY_GATE_ASSETS.mascotMobile : ENTRY_GATE_ASSETS.mascotDesktop,
  ] as const;
}

function decodeImage(src: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve();
    };

    image.decoding = 'async';
    image.onload = settle;
    image.onerror = settle;
    image.src = src;

    if (typeof image.decode === 'function') {
      void image.decode().then(settle, settle);
    } else if (image.complete) {
      settle();
    }
  });
}

async function prepareFonts() {
  if (!document.fonts?.load) return;
  await Promise.allSettled([
    document.fonts.load('800 48px "Cinzel Variable"'),
    document.fonts.load('500 12px "IBM Plex Mono"'),
    document.fonts.load('400 16px "Manrope Variable"'),
  ]);
}

export async function prepareEntryGate() {
  await Promise.allSettled([
    ...getEntryGateCriticalAssets().map(decodeImage),
    prepareFonts(),
  ]);
}

function defaultOpeningDuration() {
  return window.matchMedia('(max-width: 800px)').matches ? 2_050 : 2_200;
}

export function EntryGate({
  duration = defaultOpeningDuration(),
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  onComplete,
  prepare = prepareEntryGate,
  prepareTimeout = DEFAULT_PREPARE_TIMEOUT,
  minimumHold = DEFAULT_MINIMUM_HOLD,
}: EntryGateProps) {
  const [visible, setVisible] = useState(() => shouldPlayEntryGate(reducedMotion));
  const [active, setActive] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timers = new Set<number>();
    let openingFrame = 0;
    let cancelled = false;

    const scheduleTimer = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
      return timer;
    };

    const complete = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      markGateSeen();
      setVisible(false);
      onCompleteRef.current?.();
    };

    if (!visible) {
      complete();
      return undefined;
    }

    const wait = (delay: number) => new Promise<void>((resolve) => {
      scheduleTimer(resolve, delay);
    });
    const settlePreparation = Promise.race([
      Promise.resolve().then(prepare).catch(() => undefined),
      wait(prepareTimeout),
    ]);

    void Promise.all([settlePreparation, wait(minimumHold)]).then(() => {
      if (cancelled || completedRef.current) return;
      openingFrame = window.requestAnimationFrame(() => {
        if (cancelled || completedRef.current) return;
        setActive(true);
        scheduleTimer(complete, duration);
      });
    });

    const dismiss = () => complete();
    const onKey = (event: KeyboardEvent) => {
      if (['Enter', ' ', 'Escape', 'Tab', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key)) {
        dismiss();
      }
    };

    window.addEventListener('keydown', onKey, { passive: true });
    window.addEventListener('pointerdown', dismiss, { passive: true, once: true });
    window.addEventListener('touchstart', dismiss, { passive: true, once: true });
    window.addEventListener('wheel', dismiss, { passive: true, once: true });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(openingFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('touchstart', dismiss);
      window.removeEventListener('wheel', dismiss);
    };
  }, [duration, minimumHold, prepare, prepareTimeout, visible]);

  if (!visible) return null;

  const half = (side: 'left' | 'right') => (
    <div className={`gate-entry__leaf gate-entry__leaf--${side}`}>
      <div className="gate-entry__wall"><span className="gate-entry__masonry" /></div>
      <div className="gate-entry__door"><i /><b /></div>
      <div className="gate-entry__pier">
        <i className="gate-entry__impost" />
        <i className="gate-entry__capital" />
        <i className="gate-entry__shaft" />
        <i className="gate-entry__base" />
        <i className="gate-entry__plinth" />
      </div>
    </div>
  );

  return (
    <div
      className={`gate-entry${active ? ' gate-entry--active' : ''}`}
      data-phase={active ? 'opening' : 'preparing'}
      aria-hidden="true"
      style={{ '--gate-duration': `${duration}ms` } as React.CSSProperties}
    >
      <div className="gate-entry__ambient">
        <i className="gate-entry__ambient-light" />
      </div>
      <div className="gate-entry__portal">
        <div className="gate-entry__portal-scene" />
        <div className="gate-entry__portal-glow" />
        <div className="gate-entry__dust" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
        </div>
        <i />
      </div>
      <div className="gate-entry__light" />
      <div className="gate-entry__threshold"><i /><b /></div>
      {half('left')}
      {half('right')}
      <div className="gate-entry__arch" role="presentation">
        <div className="gate-entry__arch-half gate-entry__arch-half--left"><i /></div>
        <div className="gate-entry__arch-half gate-entry__arch-half--right"><i /></div>
      </div>
      <div className="gate-entry__entablature">
        <i className="gate-entry__cornice" />
        <i className="gate-entry__frieze" />
        <span>JRC XIV · MMXXVI</span>
      </div>
      <div className="gate-entry__standard gate-entry__standard--left"><i /><b /></div>
      <div className="gate-entry__standard gate-entry__standard--right"><i /><b /></div>
      <div className="gate-entry__seal">
        <i className="gate-entry__bracket gate-entry__bracket--left" />
        <i className="gate-entry__bracket gate-entry__bracket--right" />
        <i className="gate-entry__stud gate-entry__stud--nw" />
        <i className="gate-entry__stud gate-entry__stud--ne" />
        <i className="gate-entry__stud gate-entry__stud--sw" />
        <i className="gate-entry__stud gate-entry__stud--se" />
        <i className="gate-entry__seal-orbit" />
        <div className="gate-entry__seal-face">
          <img
            src="/assets/brand/jrc14-logo-transparent-128.webp"
            srcSet="/assets/brand/jrc14-logo-transparent-128.webp 128w, /assets/brand/jrc14-logo-transparent-256.webp 256w"
            sizes="(max-width: 800px) 98px, 144px"
            alt=""
            width="128"
            height="221"
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <small>Imperium Machina</small>
      </div>
      <div className="gate-entry__vignette" />
    </div>
  );
}

export default EntryGate;
