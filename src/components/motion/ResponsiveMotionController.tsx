import { useEffect } from 'react';

const MOTION_GROUPS = [
  { selector: '.event-brief__intro, .schedule-section__header, .faq-section__header', motion: 'from-left' },
  { selector: '.event-brief__fact, .civic-assembly__pillars > li, .patron-court__bay, .faq-item', motion: 'rise' },
  { selector: '.character-selector, .cta-section__inner', motion: 'scale' },
  { selector: '.schedule-program__heading, .history-archive__opening, .archive-entry__inscription, .civic-assembly__manifesto, .patron-court__opening, .patron-court__invitation', motion: 'editorial' },
  { selector: '.schedule-route__stations > li', motion: 'from-right' },
  { selector: '.footer-section__signature, .footer-section__manifesto, .footer-section__nav, .footer-section__legal', motion: 'quiet' },
] as const;

/** Native, bidirectional scene transitions for compact viewports. */
export function ResponsiveMotionController() {
  useEffect(() => {
    const reducedMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compactMedia = window.matchMedia('(max-width: 64rem)');
    const hoverMedia = window.matchMedia('(hover: hover)');
    const pointerMedia = window.matchMedia('(pointer: fine)');
    let observer: IntersectionObserver | null = null;
    let targets: HTMLElement[] = [];
    const clear = () => {
      observer?.disconnect();
      observer = null;
      targets.forEach((target) => {
        delete target.dataset.nativeReveal;
        delete target.dataset.nativeMotion;
        delete target.dataset.nativeEdge;
        target.style.removeProperty('--native-reveal-order');
      });
      targets = [];
    };
    const sync = () => {
      clear();
      const desktopMotion = !compactMedia.matches && hoverMedia.matches && pointerMedia.matches;
      if (reducedMedia.matches || desktopMotion || !('IntersectionObserver' in window)) return;
      MOTION_GROUPS.forEach(({ selector, motion }) => {
      document.querySelectorAll<HTMLElement>(selector).forEach((target, index) => {
        if (targets.includes(target)) return;
        target.dataset.nativeReveal = 'pending';
        target.dataset.nativeMotion = motion;
        target.dataset.nativeEdge = 'below';
        target.style.setProperty('--native-reveal-order', String(index % 4));
        targets.push(target);
      });
    });

      observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            target.dataset.nativeReveal = 'visible';
            return;
          }

          // Elements above the viewport retreat upward. When the user reverses,
          // they re-enter from that same edge instead of always rising from below.
          target.dataset.nativeEdge = entry.boundingClientRect.top < window.innerHeight / 2 ? 'above' : 'below';
          target.dataset.nativeReveal = 'pending';
        });
      },
      { rootMargin: '-7% 0px -7% 0px', threshold: [0, 0.12, 0.55] },
    );

      targets.forEach((target) => observer?.observe(target));
    };
    sync();
    reducedMedia.addEventListener('change', sync);
    compactMedia.addEventListener('change', sync);
    hoverMedia.addEventListener('change', sync);
    pointerMedia.addEventListener('change', sync);
    return () => {
      reducedMedia.removeEventListener('change', sync);
      compactMedia.removeEventListener('change', sync);
      hoverMedia.removeEventListener('change', sync);
      pointerMedia.removeEventListener('change', sync);
      clear();
    };
  }, []);

  return null;
}

export default ResponsiveMotionController;
