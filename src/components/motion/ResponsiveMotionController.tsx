import { useEffect } from 'react';

const REVEAL_SELECTORS = [
  '.event-brief__intro',
  '.event-brief__details',
  '.character-selector__stage',
  '.character-selector__name',
  '.schedule-section__header',
  '.schedule-via__card',
  '.history-procession__opening',
  '.history-procession__inscription',
  '.civic-assembly__manifesto',
  '.civic-assembly__pillars',
  '.patron-court__opening',
  '.patron-court__colonnade',
  '.faq-section__header',
  '.faq-section__items',
  '.cta-section__inner',
];

export function ResponsiveMotionController() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compactMotion = window.matchMedia('(max-width: 64rem), (hover: none), (pointer: coarse)').matches;
    if (reducedMotion || !compactMotion || !('IntersectionObserver' in window)) return undefined;

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTORS.join(',')),
    );
    targets.forEach((target, index) => {
      target.setAttribute('data-native-reveal', 'pending');
      target.style.setProperty('--native-reveal-order', String(index % 4));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          (entry.target as HTMLElement).setAttribute(
            'data-native-reveal',
            entry.isIntersecting ? 'visible' : 'pending',
          );
        });
      },
      { rootMargin: '-8% 0px -8% 0px', threshold: 0.12 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => {
      observer.disconnect();
      targets.forEach((target) => {
        target.removeAttribute('data-native-reveal');
        target.style.removeProperty('--native-reveal-order');
      });
    };
  }, []);

  return null;
}

export default ResponsiveMotionController;
