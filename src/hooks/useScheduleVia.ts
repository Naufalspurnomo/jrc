import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect } from 'react';

gsap.registerPlugin(ScrollTrigger);

/**
 * Draws the winding Roman-road path as the user scrolls through
 * the schedule section, and lights up each milestone node as it passes.
 */
export function useScheduleVia() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const useNativeMotion = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
    if (reducedMotion || useNativeMotion) return undefined;

    const track = document.getElementById('schedule-via-track');
    const section = document.querySelector('.schedule-section');
    if (!track || !section) return undefined;

    const trigger = gsap.to(track, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top 75%',
        end: 'bottom 55%',
        scrub: 0.6,
      },
    });

    return () => {
      trigger.scrollTrigger?.kill();
      trigger.kill();
      gsap.set(track, { clearProps: 'stroke-dashoffset' });
    };
  }, []);
}

export default useScheduleVia;
