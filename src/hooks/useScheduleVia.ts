import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect } from 'react';

gsap.registerPlugin(ScrollTrigger);

/** Adds progressive route drawing and restrained spatial settling on fine-pointer desktops. */
export function useScheduleVia({ disabled = false }: { disabled?: boolean } = {}) {
  useEffect(() => {
    if (disabled) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const useNativeMotion = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
    if (reducedMotion || useNativeMotion) return undefined;

    const section = document.querySelector<HTMLElement>('.schedule-section');
    const track = section?.querySelector<SVGPathElement>('#schedule-via-track');
    const figure = section?.querySelector<HTMLElement>('.schedule-arrival__sentinel');
    const machine = section?.querySelector<HTMLElement>('.schedule-program__machine');
    const stone = section?.querySelector<HTMLElement>('.schedule-program__stone');
    const titleLines = section?.querySelectorAll<HTMLElement>('.schedule-section__header h2 span');
    if (!section || !track) return undefined;

    // Text remains visible before GSAP initializes; the mask only animates after this context exists.
    const context = gsap.context(() => {
      if (titleLines?.length) {
        gsap.fromTo(
          titleLines,
          { clipPath: 'inset(0 0 0 0)', yPercent: 8 },
          { clipPath: 'inset(0 0 0 0)', yPercent: 0, duration: 1.05, stagger: 0.08, ease: 'power3.out' },
        );
      }

      gsap.fromTo(track, { strokeDashoffset: 1 }, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: { trigger: '.schedule-program', start: 'top 78%', end: 'bottom 62%', scrub: 0.55 },
      });

      if (figure) gsap.to(figure, { yPercent: -5, ease: 'none', scrollTrigger: { trigger: '.schedule-arrival', start: 'top bottom', end: 'bottom top', scrub: 0.7 } });
      if (machine) gsap.fromTo(machine, { yPercent: 8 }, { yPercent: -3, ease: 'none', scrollTrigger: { trigger: '.schedule-program', start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
      if (stone) gsap.fromTo(stone, { yPercent: -10 }, { yPercent: 0, ease: 'power2.out', scrollTrigger: { trigger: '.schedule-program', start: 'top 90%', end: 'top 55%', scrub: 0.6 } });
    }, section);

    return () => context.revert();
  }, [disabled]);
}

export default useScheduleVia;
