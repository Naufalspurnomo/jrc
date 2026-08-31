import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect } from 'react';

gsap.registerPlugin(ScrollTrigger);

interface RevealOptions {
  scope?: HTMLElement | null;
  extra?: string[];
  disabled?: boolean;
}

const DEFAULT_SELECTORS = [
  '.event-brief__intro',
  '.event-brief__fact',
  '.character-selector',
  '.schedule-section__header',
  '.schedule-route__stations > li',
  '.archive-entry',
  '.civic-assembly__manifesto',
  '.patron-court__opening',
  '.patron-court__bay',
  '.faq-section__header',
  '.faq-section__items',
  '.cta-section__inner',
  '.competition-brief__layout > *',
  '.competition-intel header',
  '.competition-intel dl',
];

/** Applies one-time entrance transitions to public content sections. */
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
