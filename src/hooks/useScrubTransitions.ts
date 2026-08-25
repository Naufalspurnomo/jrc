import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect } from 'react';

gsap.registerPlugin(ScrollTrigger);

interface ScrubOptions { disabled?: boolean; }
type MotionTarget = HTMLElement | HTMLElement[] | NodeListOf<HTMLElement>;

interface SceneMotionOptions {
  trigger: HTMLElement;
  targets: MotionTarget;
  from?: gsap.TweenVars;
  settle?: gsap.TweenVars;
  leave?: gsap.TweenVars;
  start?: string;
  end?: string;
  scrub?: number;
  stagger?: number;
  enterDuration?: number;
  leaveAt?: number;
}

const managedElements = new Set<HTMLElement>();
const resolveTargets = (targets: MotionTarget) => gsap.utils.toArray<HTMLElement>(targets);

function setMotionBudget(targets: HTMLElement[], active: boolean) {
  targets.forEach((target) => {
    managedElements.add(target);
    target.dataset.motionManaged = '';
    target.style.willChange = active ? 'transform, opacity' : 'auto';
  });
}

/** Reversible enter → hold → exit scene. Up-scroll is the exact inverse. */
function createSceneMotion({
  trigger,
  targets,
  from = { y: 42, opacity: 0.18 },
  settle = { y: 0, opacity: 1 },
  leave = { y: -24, opacity: 0.55 },
  start = 'top 92%',
  end = 'bottom 8%',
  scrub = 0.72,
  stagger = 0.045,
  enterDuration = 0.25,
  leaveAt = 0.78,
}: SceneMotionOptions) {
  const elements = resolveTargets(targets);
  if (!elements.length) return null;

  const timeline = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger,
      start,
      end,
      scrub,
      invalidateOnRefresh: true,
      onToggle: (self) => setMotionBudget(elements, self.isActive),
    },
  });

  timeline.fromTo(elements, from, {
    ...settle,
    duration: enterDuration,
    stagger,
    immediateRender: false,
  }, 0);
  timeline.to(elements, {
    ...leave,
    duration: 1 - leaveAt,
    stagger: stagger ? stagger * 0.45 : 0,
  }, leaveAt);
  return timeline;
}

function createParallax(
  trigger: HTMLElement,
  targets: MotionTarget,
  from: gsap.TweenVars,
  to: gsap.TweenVars,
  start = 'top bottom',
  end = 'bottom top',
  scrub = 1.15,
) {
  const elements = resolveTargets(targets);
  if (!elements.length) return null;
  return gsap.fromTo(elements, from, {
    ...to,
    ease: 'none',
    immediateRender: false,
    scrollTrigger: {
      trigger,
      start,
      end,
      scrub,
      invalidateOnRefresh: true,
      onToggle: (self) => setMotionBudget(elements, self.isActive),
    },
  });
}

/**
 * Imperium Machina — ceremonial momentum.
 * One desktop choreography, reversible scrub, temporary compositor promotion,
 * and no competing one-shot reveal systems.
 */
export function useScrubTransitions({ disabled = false }: ScrubOptions = {}) {
  useEffect(() => {
    if (disabled) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compactPointer = window.matchMedia('(max-width: 64rem), (hover: none), (pointer: coarse)').matches;
    if (reducedMotion || compactPointer) return undefined;

    const root = document.documentElement;
    root.dataset.motionSystem = 'ceremonial';

    const context = gsap.context(() => {
      // Hero: foreground withdraws while the architectural layers drift deeper.
      const hero = document.querySelector<HTMLElement>('.hero-section');
      const heroContent = hero?.querySelector<HTMLElement>('.hero-section__content');
      const heroVisual = hero?.querySelector<HTMLElement>('.hero-section__visual');
      const heroShade = hero?.querySelector<HTMLElement>('.hero-section__shade');
      const heroEngravings = hero?.querySelectorAll<HTMLElement>('.hero-section__engraving');
      if (hero && heroContent) createParallax(hero, heroContent, { y: 0, scale: 1, opacity: 1 }, { y: -84, scale: 0.975, opacity: 0.48 }, 'top top', 'bottom top', 0.85);
      if (hero && heroVisual) createParallax(hero, heroVisual, { yPercent: 0, scale: 1 }, { yPercent: 8, scale: 1.055 }, 'top top', 'bottom top', 1.15);
      if (hero && heroShade) createParallax(hero, heroShade, { opacity: 0.82 }, { opacity: 1 }, 'top top', 'bottom top', 0.8);
      if (hero && heroEngravings?.length) createParallax(hero, heroEngravings, { yPercent: 0, scale: 1 }, { yPercent: 13, scale: 1.025 }, 'top top', 'bottom top', 1.35);

      // Event brief: editorial intro, followed by the three date/location markers.
      const eventBrief = document.querySelector<HTMLElement>('.event-brief');
      const eventIntro = eventBrief?.querySelector<HTMLElement>('.event-brief__intro');
      const eventFacts = eventBrief?.querySelectorAll<HTMLElement>('.event-brief__fact');
      const eventGlow = eventBrief?.querySelector<HTMLElement>('.event-brief__glow');
      if (eventBrief && eventIntro) createSceneMotion({
        trigger: eventBrief, targets: eventIntro,
        from: { x: -42, y: 20, opacity: 0.2 }, settle: { x: 0, y: 0, opacity: 1 },
        leave: { x: 22, y: -20, opacity: 0.58 }, start: 'top 90%', end: 'bottom 12%',
      });
      if (eventBrief && eventFacts?.length) createSceneMotion({
        trigger: eventBrief, targets: eventFacts,
        from: { y: 48, opacity: 0.12, scale: 0.965 }, settle: { y: 0, opacity: 1, scale: 1 },
        leave: { y: -20, opacity: 0.62, scale: 0.99 }, stagger: 0.065, leaveAt: 0.76,
      });
      if (eventBrief && eventGlow) createParallax(eventBrief, eventGlow, { yPercent: 12, scale: 0.96 }, { yPercent: -14, scale: 1.08 });

      // Character showcase: one large reveal plus smaller typographic movement.
      const showcase = document.querySelector<HTMLElement>('.showcase-hero');
      const selector = showcase?.querySelector<HTMLElement>('.character-selector');
      const showcaseCopy = showcase?.querySelectorAll<HTMLElement>('.character-selector__eyebrow, .character-selector__name, .character-selector__footer');
      const lightSweep = showcase?.querySelector<HTMLElement>('.character-selector__light-sweep');
      if (showcase && selector) createSceneMotion({
        trigger: showcase, targets: selector,
        from: { y: 64, opacity: 0.28, scale: 0.955 }, settle: { y: 0, opacity: 1, scale: 1 },
        leave: { y: -42, opacity: 0.7, scale: 1.018 }, start: 'top 94%', end: 'bottom 5%',
        scrub: 0.9, enterDuration: 0.3,
      });
      if (showcase && showcaseCopy?.length) createSceneMotion({
        trigger: showcase, targets: showcaseCopy,
        from: { y: 26, opacity: 0 }, settle: { y: 0, opacity: 1 }, leave: { y: -16, opacity: 0.62 },
        start: 'top 82%', end: 'bottom 12%', stagger: 0.055,
      });
      if (showcase && lightSweep) createParallax(showcase, lightSweep, { xPercent: -8, opacity: 0.25 }, { xPercent: 8, opacity: 0.7 });

      // Schedule: architecture carries depth, the route is drawn by scroll.
      const schedule = document.querySelector<HTMLElement>('.schedule-section');
      const arrival = schedule?.querySelector<HTMLElement>('.schedule-arrival');
      const architecture = arrival?.querySelector<HTMLElement>('.schedule-arrival__architecture');
      const scheduleHeader = schedule?.querySelector<HTMLElement>('.schedule-section__header');
      const program = schedule?.querySelector<HTMLElement>('.schedule-program');
      const scheduleStone = program?.querySelector<HTMLElement>('.schedule-program__stone');
      const scheduleHeading = program?.querySelector<HTMLElement>('.schedule-program__heading');
      const routePath = program?.querySelector<SVGPathElement>('#schedule-via-track');
      const stations = program?.querySelectorAll<HTMLElement>('.schedule-route__stations > li');
      if (arrival && architecture) createParallax(arrival, architecture, { yPercent: -4, scale: 1.08 }, { yPercent: 5, scale: 1.02 }, 'top bottom', 'bottom top', 1.35);
      if (arrival && scheduleHeader) createSceneMotion({
        trigger: arrival, targets: scheduleHeader,
        from: { y: 54, opacity: 0.12, scale: 0.975 }, settle: { y: 0, opacity: 1, scale: 1 },
        leave: { y: -32, opacity: 0.5, scale: 0.99 }, start: 'top 88%', end: 'bottom 10%',
      });
      if (program && scheduleStone) createParallax(program, scheduleStone, { yPercent: -5, scale: 1.06 }, { yPercent: 5, scale: 1.015 }, 'top bottom', 'bottom top', 1.4);
      if (program && scheduleHeading) createSceneMotion({ trigger: program, targets: scheduleHeading, start: 'top 90%', end: 'bottom 10%' });
      if (program && routePath) {
        gsap.set(routePath, { strokeDasharray: 1, strokeDashoffset: 1 });
        gsap.to(routePath, {
          strokeDashoffset: 0, ease: 'none',
          scrollTrigger: { trigger: program, start: 'top 68%', end: 'bottom 38%', scrub: 0.55, invalidateOnRefresh: true },
        });
      }
      stations?.forEach((station, index) => {
        const direction = index % 2 === 0 ? -1 : 1;
        createSceneMotion({
          trigger: station, targets: station,
          from: { x: 38 * direction, y: 28, opacity: 0.12 }, settle: { x: 0, y: 0, opacity: 1 },
          leave: { x: -14 * direction, y: -18, opacity: 0.58 }, start: 'top 91%', end: 'bottom 14%',
          scrub: 0.58, stagger: 0, enterDuration: 0.33, leaveAt: 0.74,
        });
      });

      // Lower world: text moves against stable image crops for low-cost depth.
      document.querySelectorAll<HTMLElement>('.history-procession .journey-scene').forEach((scene, index) => {
        const content = scene.querySelector<HTMLElement>('.history-procession__opening, .history-procession__inscription, .civic-assembly__manifesto');
        if (content) {
          const horizontal = index % 2 === 0 ? -22 : 22;
          createSceneMotion({
            trigger: scene, targets: content,
            from: { x: horizontal, y: 48, opacity: 0.16, scale: 0.982 }, settle: { x: 0, y: 0, opacity: 1, scale: 1 },
            leave: { x: -horizontal * 0.45, y: -30, opacity: 0.52, scale: 1.008 },
            start: 'top 92%', end: 'bottom 8%', scrub: 0.8, enterDuration: 0.28,
          });
        }
        const pillars = scene.querySelectorAll<HTMLElement>('.civic-assembly__pillars > li');
        if (pillars.length) createSceneMotion({
          trigger: scene, targets: pillars,
          from: { y: 38, opacity: 0.12 }, settle: { y: 0, opacity: 1 }, leave: { y: -20, opacity: 0.56 },
          start: 'top 78%', end: 'bottom 12%', stagger: 0.07, leaveAt: 0.74,
        });
      });

      const partners = document.querySelector<HTMLElement>('.journey-scene--partners');
      const partnerOpening = partners?.querySelector<HTMLElement>('.patron-court__opening');
      const partnerBays = partners?.querySelectorAll<HTMLElement>('.patron-court__bay');
      const partnerInvite = partners?.querySelector<HTMLElement>('.patron-court__invitation');
      if (partners && partnerOpening) createSceneMotion({ trigger: partners, targets: partnerOpening });
      if (partners && partnerBays?.length) createSceneMotion({
        trigger: partners, targets: partnerBays,
        from: { x: -34, opacity: 0.12 }, settle: { x: 0, opacity: 1 }, leave: { x: 18, opacity: 0.54 },
        start: 'top 78%', end: 'bottom 14%', stagger: 0.065,
      });
      if (partners && partnerInvite) createSceneMotion({
        trigger: partners, targets: partnerInvite,
        from: { y: 28, opacity: 0 }, settle: { y: 0, opacity: 1 }, leave: { y: -16, opacity: 0.56 },
        start: 'top 66%', end: 'bottom 10%',
      });

      const faq = document.querySelector<HTMLElement>('.journey-scene--faq');
      const faqHeader = faq?.querySelector<HTMLElement>('.faq-section__header');
      const faqItems = faq?.querySelectorAll<HTMLElement>('.faq-item');
      if (faq && faqHeader) createSceneMotion({
        trigger: faq, targets: faqHeader,
        from: { x: -36, y: 18, opacity: 0.14 }, settle: { x: 0, y: 0, opacity: 1 }, leave: { x: 18, y: -18, opacity: 0.58 },
      });
      if (faq && faqItems?.length) createSceneMotion({
        trigger: faq, targets: faqItems,
        from: { x: 34, opacity: 0.1 }, settle: { x: 0, opacity: 1 }, leave: { x: -16, opacity: 0.58 },
        start: 'top 82%', end: 'bottom 10%', stagger: 0.045, leaveAt: 0.75,
      });

      // Final gate and footer conclude the motion language instead of stopping.
      const cta = document.querySelector<HTMLElement>('.cta-section');
      const ctaGate = cta?.querySelector<HTMLElement>('.cta-gate');
      const ctaInner = cta?.querySelector<HTMLElement>('.cta-section__inner');
      const ctaEmbers = cta?.querySelectorAll<HTMLElement>('.cta-ember');
      if (cta && ctaGate) createParallax(cta, ctaGate, { yPercent: 7, scale: 1.06 }, { yPercent: -4, scale: 1.01 }, 'top bottom', 'bottom top', 1.25);
      if (cta && ctaInner) createSceneMotion({
        trigger: cta, targets: ctaInner,
        from: { y: 54, opacity: 0.08, scale: 0.97 }, settle: { y: 0, opacity: 1, scale: 1 },
        leave: { y: -24, opacity: 0.7, scale: 1.006 }, start: 'top 92%', end: 'bottom 4%', scrub: 0.8, enterDuration: 0.32,
      });
      if (cta && ctaEmbers?.length) createParallax(cta, ctaEmbers, { yPercent: 36, opacity: 0.15 }, { yPercent: -34, opacity: 0.7 }, 'top bottom', 'bottom top', 1.5);

      const footer = document.querySelector<HTMLElement>('.footer-section');
      const footerWatermark = footer?.querySelector<HTMLElement>('.footer-watermark');
      const footerContent = footer?.querySelectorAll<HTMLElement>('.footer-section__signature, .footer-section__manifesto, .footer-section__nav, .footer-section__legal');
      if (footer && footerWatermark) createParallax(footer, footerWatermark, { yPercent: 22, opacity: 0.18 }, { yPercent: -8, opacity: 0.52 }, 'top bottom', 'bottom bottom', 1.2);
      if (footer && footerContent?.length) createSceneMotion({
        trigger: footer, targets: footerContent,
        from: { y: 26, opacity: 0.1 }, settle: { y: 0, opacity: 1 }, leave: { y: 0, opacity: 1 },
        start: 'top 96%', end: 'bottom bottom', stagger: 0.04, enterDuration: 0.48, leaveAt: 0.98,
      });
    });

    // Every trigger measures itself when it is created. Sorting preserves the
    // intended order without a late global refresh that restores scroll to 0.
    ScrollTrigger.sort();

    return () => {
      context.revert();
      managedElements.forEach((element) => {
        element.style.removeProperty('will-change');
        delete element.dataset.motionManaged;
      });
      managedElements.clear();
      delete root.dataset.motionSystem;
      delete root.dataset.scrollDirection;
    };
  }, [disabled]);
}

export default useScrubTransitions;
