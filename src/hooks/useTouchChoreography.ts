import { useEffect } from 'react';

const SELECTORS = [
  '.arena-facts__intro',
  '.arena-facts__register',
  '.arena-facts__fact',

  '.history-section__header',
  '.history-editorial__entry',
  '.history-festival',
  '.partner-section__header',
  '.partner-tier',
  '.partner-announcement',
  '.faq-section__header',
  '.faq-item',
  '.cta-section__inner',
  '.footer-section__signature',
  '.footer-section__manifesto',
  '.footer-section nav',
] as const;

/** Lightweight choreography for touch devices excluded from the GSAP desktop system. */
export function useTouchChoreography() {
  useEffect(() => {
    const touchLayout = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!touchLayout || reducedMotion || !('IntersectionObserver' in window)) return undefined;

    const targets = Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.join(',')));
    targets.forEach((target, index) => {
      target.classList.add('touch-reveal');
      target.style.setProperty('--touch-order', String(index % 4));
    });

    document.documentElement.classList.add('touch-motion-ready');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).classList.add('touch-reveal--visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('touch-motion-ready');
      targets.forEach((target) => {
        target.classList.remove('touch-reveal', 'touch-reveal--visible');
        target.style.removeProperty('--touch-order');
      });
    };
  }, []);
}

export default useTouchChoreography;
