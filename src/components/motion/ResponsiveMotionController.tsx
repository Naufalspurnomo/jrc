import { useEffect } from 'react';

const REVEAL_SELECTORS = [
  '.arena-facts__intro',
  '.arena-facts__register',
  '.character-selector__stage',
  '.character-selector__name',
  '.history-section__header',
  '.history-editorial__entry',
  '.history-festival',
  '.partner-section__header',
  '.partner-section__tiers',
  '.faq-section__header',
  '.faq-section__items',
  '.cta-section__inner',
];

export function ResponsiveMotionController() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) return undefined;

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTORS.join(',')),
    );
    targets.forEach((target) => target.setAttribute('data-native-reveal', 'pending'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).setAttribute('data-native-reveal', 'visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => {
      observer.disconnect();
      targets.forEach((target) => target.removeAttribute('data-native-reveal'));
    };
  }, []);

  return null;
}

export default ResponsiveMotionController;
