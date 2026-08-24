import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect } from 'react';

gsap.registerPlugin(ScrollTrigger);

interface RevealOptions {
  /** Selector scope — defaults to document. */
  scope?: HTMLElement | null;
  /** Extra selectors to reveal, appended to the default set. */
  extra?: string[];
  /** Disable all animation (reduced motion / static contexts). */
  disabled?: boolean;
}

const DEFAULT_SELECTORS = [
  '.arena-facts__intro',
  '.arena-facts__register',
  '.arena-facts__fact',
  '.character-select__header',
  '.cs-card',
  '.schedule-section__header',
  '.schedule-section__timeline li',
  '.history-section__header',
  '.history-section__chapters li',
  '.history-festival',
  '.partner-section__header',
  '.partner-section__tiers > div',
  '.faq-section__header',
  '.faq-section__items',
  '.cta-section__inner',
  '.competition-brief__layout > *',
  '.competition-intel header',
  '.competition-intel dl',
];

/**
 * Scroll-triggered entrance reveal for sections and list items.
 * Animates opacity + y only (transform/opacity — layout-safe),
 * respects prefers-reduced-motion via the disabled flag.
 */
export function useScrollReveal({ scope, extra = [], disabled = false }: RevealOptions = {}) {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const useNativeMotion = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
    if (disabled || reducedMotion || useNativeMotion) return undefined;
    const root = scope ?? document.body;
    const targets = root.querySelectorAll(
      [...DEFAULT_SELECTORS, ...extra].filter((selector) => selector.startsWith('.')).join(','),
    );

    if (targets.length === 0) return undefined;

    const triggers: ScrollTrigger[] = [];
    targets.forEach((target) => {
      const rect = target.getBoundingClientRect();
      const isBelowViewport = rect.top > window.innerHeight * 0.92;
      if (isBelowViewport) gsap.set(target, { opacity: 0, y: 28 });
      triggers.push(
        ScrollTrigger.create({
          trigger: target,
          start: 'top 88%',
          once: true,
          onEnter: () => {
            gsap.to(target, {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: 'power3.out',
              overwrite: 'auto',
            });
          },
        }),
      );
    });

    return () => {
      triggers.forEach((trigger) => trigger.kill());
      gsap.set(targets, { clearProps: 'opacity,transform' });
    };
  }, [scope, disabled, extra]);
}

export default useScrollReveal;
