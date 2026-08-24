import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect } from 'react';

gsap.registerPlugin(ScrollTrigger);

interface ScrubOptions {
  disabled?: boolean;
}

/**
 * Imperium Machina — modern scrub transitions.
 * Rome × Robotic: clip-reveal, depth parallax, HUD line draw, scale/blur deploy.
 * Desktop only. GPU: transform / opacity / clipPath. Scrub tied to scroll.
 */
export function useScrubTransitions({ disabled = false }: ScrubOptions = {}) {
  useEffect(() => {
    if (disabled) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
    if (reducedMotion || isMobile) return undefined;

    const triggers: ScrollTrigger[] = [];
    const tweens: gsap.core.Tween[] = [];
    const timelines: gsap.core.Timeline[] = [];

    const track = (t: gsap.core.Tween | gsap.core.Timeline) => {
      const st = (t as unknown as { scrollTrigger?: ScrollTrigger }).scrollTrigger;
      if (st) triggers.push(st);
      if ((t as unknown as { then?: unknown }).then === undefined && 'duration' in (t as object)) {
        tweens.push(t as gsap.core.Tween);
      } else {
        timelines.push(t as gsap.core.Timeline);
      }
    };

    // ── HERO — depth deploy (parallax + scale + clip) ──
    const hero = document.querySelector<HTMLElement>('.hero-section');
    const heroContent = document.querySelector<HTMLElement>('.hero-section__content');
    const heroVisual = document.querySelector<HTMLElement>('.hero-section__visual');
    const heroTitle = document.querySelector<HTMLElement>('.hero-section__title-lockup h1');
    const heroTheme = document.querySelector<HTMLElement>('.hero-section__theme');
    const heroShade = document.querySelector<HTMLElement>('.hero-section__shade');

    if (hero && heroContent) {
      // Content lifts & fades with subtle scale — like HUD retracting
      track(
        gsap.fromTo(
          heroContent,
          { y: 0, scale: 1, opacity: 1, filter: 'blur(0px)' },
          {
            y: -90,
            scale: 0.96,
            opacity: 0.65,
            filter: 'blur(3px)',
            ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1.1 },
          },
        ),
      );
    }
    if (hero && heroVisual) {
      track(
        gsap.fromTo(
          heroVisual,
          { yPercent: 0, scale: 1 },
          {
            yPercent: 10,
            scale: 1.06,
            ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1.4 },
          },
        ),
      );
    }
    if (heroShade && hero) {
      track(
        gsap.fromTo(
          heroShade,
          { opacity: 1 },
          {
            opacity: 0.35,
            ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 20%', scrub: 1 },
          },
        ),
      );
    }
    if (heroTheme && hero) {
      gsap.set(heroTheme, { clipPath: 'inset(0 100% 0 0)' });
      track(
        gsap.to(heroTheme, {
          clipPath: 'inset(0 0% 0 0)',
          ease: 'none',
          scrollTrigger: { trigger: hero, start: 'top 92%', end: 'top 62%', scrub: 1 },
        }),
      );
    }
    if (heroTitle && hero) {
      gsap.set(heroTitle, { y: 28, opacity: 0, clipPath: 'inset(0 0 100% 0)' });
      track(
        gsap.to(heroTitle, {
          y: 0,
          opacity: 1,
          clipPath: 'inset(0 0 0% 0)',
          ease: 'none',
          scrollTrigger: { trigger: hero, start: 'top 88%', end: 'top 42%', scrub: 1.1 },
        }),
      );
    }

    // ── EVENT FACTS — Signal Sheet deploy (clip + line draw) ──
    const arena = document.querySelector<HTMLElement>('.arena-facts');
    if (arena) {
      const edition = arena.querySelector<HTMLElement>('.arena-facts__edition');
      const intro = arena.querySelector<HTMLElement>('.arena-facts__intro');
      const sectionLabel = arena.querySelector<HTMLElement>('.arena-facts__section-label');
      const title = arena.querySelector<HTMLElement>('.arena-facts__title');
      const facts = arena.querySelectorAll<HTMLElement>('.arena-facts__fact');

      if (edition) {
        gsap.set(edition, { scale: 0.82, rotate: -1.5, opacity: 0, filter: 'blur(6px)' });
        track(
          gsap.to(edition, {
            scale: 1,
            rotate: 0,
            opacity: 1,
            filter: 'blur(0px)',
            ease: 'none',
            scrollTrigger: { trigger: arena, start: 'top 82%', end: 'top 42%', scrub: 1.2 },
          }),
        );
      }
      if (intro && title) {
        gsap.set(title, { y: 36, opacity: 0, clipPath: 'inset(0 0 100% 0)' });
        track(
          gsap.to(title, {
            y: 0,
            opacity: 1,
            clipPath: 'inset(0 0 0% 0)',
            ease: 'none',
            scrollTrigger: { trigger: arena, start: 'top 78%', end: 'top 38%', scrub: 1.1 },
          }),
        );
      }
      if (sectionLabel) {
        gsap.set(sectionLabel, { y: 16, opacity: 0, letterSpacing: '0.28em', filter: 'blur(4px)' });
        track(
          gsap.to(sectionLabel, {
            y: 0,
            opacity: 1,
            letterSpacing: '0.16em',
            filter: 'blur(0px)',
            ease: 'none',
            scrollTrigger: { trigger: arena, start: 'top 84%', end: 'top 58%', scrub: 1 },
          }),
        );
      }
      if (facts.length) {
        // Registry lines draw: each fact's top rule scales from left.
        facts.forEach((fact) => {
          fact.style.setProperty('--fact-line', '0');
        });
        gsap.set(facts, { y: 26, opacity: 0, clipPath: 'inset(0 100% 0 0)' });
        facts.forEach((fact) => {
          track(
            gsap.to(fact, {
              y: 0,
              opacity: 1,
              clipPath: 'inset(0 0% 0 0)',
              ease: 'none',
              scrollTrigger: {
                trigger: fact,
                start: 'top 92%',
                end: 'top 62%',
                scrub: 1,
              },
            }),
          );
          // HUD line draw via CSS var
          track(
            gsap.fromTo(
              fact,
              { ['--fact-line' as string]: 0 },
              {
                ['--fact-line' as string]: 1,
                ease: 'none',
                scrollTrigger: { trigger: fact, start: 'top 92%', end: 'top 62%', scrub: 1 },
              },
            ),
          );
        });
      }
    }

    // ── SHOWCASE — character stage mech deploy (3D tilt + scan) ──
    const showcase = document.querySelector<HTMLElement>('.showcase-hero');
    const charSelector = document.querySelector<HTMLElement>('.character-selector');
    const charStage = document.querySelector<HTMLElement>('.character-selector__stage');
    const charPortal = document.querySelector<HTMLElement>('.character-selector__portal');
    const charName = document.querySelector<HTMLElement>('.character-selector__name');
    const charFooter = document.querySelector<HTMLElement>('.character-selector__footer');
    const charEyebrow = document.querySelector<HTMLElement>('.character-selector__eyebrow');

    if (showcase) {
      // Atmospheric bg parallax — robotic depth
      track(
        gsap.fromTo(
          showcase,
          { backgroundPositionY: '54%' },
          {
            backgroundPositionY: '42%',
            ease: 'none',
            scrollTrigger: { trigger: showcase, start: 'top bottom', end: 'bottom top', scrub: 1.6 },
          },
        ),
      );
      if (charEyebrow) {
        gsap.set(charEyebrow, { y: 18, opacity: 0, letterSpacing: '0.28em', filter: 'blur(4px)' });
        track(
          gsap.to(charEyebrow, {
            y: 0,
            opacity: 1,
            letterSpacing: '0.18em',
            filter: 'blur(0px)',
            ease: 'none',
            scrollTrigger: { trigger: showcase, start: 'top 86%', end: 'top 56%', scrub: 1 },
          }),
        );
      }
      if (charStage || charPortal) {
        const target = charStage ?? charPortal ?? charSelector;
        if (target) {
          gsap.set(target, {
            y: 48,
            scale: 0.92,
            rotateX: 8,
            opacity: 0,
            clipPath: 'inset(12% 8% 12% 8% round 1.25rem)',
          } as unknown as object);
          track(
            gsap.to(target, {
              y: 0,
              scale: 1,
              rotateX: 0,
              opacity: 1,
              clipPath: 'inset(0% 0% 0% 0% round 1.25rem)',
              ease: 'none',
              scrollTrigger: { trigger: showcase, start: 'top 78%', end: 'top 22%', scrub: 1.3 },
            }),
          );
        }
      }
      if (charSelector && charStage) {
        // Portal light sweep — scan line tied to scroll
        const sweep = showcase.querySelector<HTMLElement>('.character-selector__light-sweep');
        if (sweep) {
          track(
            gsap.fromTo(
              sweep,
              { xPercent: -120, opacity: 0 },
              {
                xPercent: 420,
                opacity: 0.9,
                ease: 'none',
                scrollTrigger: { trigger: showcase, start: 'top 72%', end: 'top 18%', scrub: 1.1 },
              },
            ),
          );
        }
      }
      if (charName) {
        gsap.set(charName, { y: 32, opacity: 0, clipPath: 'inset(0 0 100% 0)', scale: 0.97 });
        track(
          gsap.to(charName, {
            y: 0,
            opacity: 1,
            clipPath: 'inset(0 0 0% 0)',
            scale: 1,
            ease: 'none',
            scrollTrigger: { trigger: showcase, start: 'top 52%', end: 'top 16%', scrub: 1 },
          }),
        );
      }
      if (charFooter) {
        gsap.set(charFooter, { y: 22, opacity: 0 });
        track(
          gsap.to(charFooter, {
            y: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: showcase, start: 'top 38%', end: 'top 10%', scrub: 1 },
          }),
        );
      }
    }

    // ── SCHEDULE — Roman road + milestone deploy with glow ──
    const schedule = document.querySelector<HTMLElement>('#jadwal');
    const viaTrack = document.getElementById('schedule-via-track') as unknown as HTMLElement | null;
    const milestones = document.querySelectorAll<HTMLElement>('#jadwal .schedule-via__milestones li');
    const schedPath = document.querySelector<HTMLElement>('.schedule-via__path');

    if (schedPath && schedule) {
      track(
        gsap.fromTo(
          schedPath,
          { opacity: 0.45 },
          { opacity: 1, ease: 'none', scrollTrigger: { trigger: schedule, start: 'top 78%', end: 'bottom 55%', scrub: 1 } },
        ),
      );
    }
    if (schedule && viaTrack) {
      const len = (viaTrack as unknown as { getTotalLength?: () => number }).getTotalLength?.() ?? 0;
      if (len > 0) gsap.set(viaTrack, { strokeDasharray: len, strokeDashoffset: len });
      else gsap.set(viaTrack, { strokeDashoffset: 1 });
      track(
        gsap.to(viaTrack, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: { trigger: schedule, start: 'top 74%', end: 'bottom 52%', scrub: 1 },
        }),
      );
    }
    if (milestones.length && schedule) {
      milestones.forEach((item) => {
        const node = item.querySelector<HTMLElement>('.schedule-via__node');
        const card = item.querySelector<HTMLElement>('.schedule-via__card');
        gsap.set(item, { opacity: 1 });
        if (card) gsap.set(card, { y: 28, opacity: 0, clipPath: 'inset(0 100% 0 0)', scale: 0.98 });
        if (node) gsap.set(node, { scale: 0.4, opacity: 0, filter: 'blur(6px)' });

        if (card) {
          track(
            gsap.to(card, {
              y: 0,
              opacity: 1,
              clipPath: 'inset(0 0% 0 0)',
              scale: 1,
              ease: 'none',
              scrollTrigger: { trigger: item, start: 'top 88%', end: 'top 54%', scrub: 1 },
            }),
          );
        }
        if (node) {
          track(
            gsap.to(node, {
              scale: 1,
              opacity: 1,
              filter: 'blur(0px)',
              ease: 'none',
              scrollTrigger: { trigger: item, start: 'top 88%', end: 'top 60%', scrub: 1 },
            }),
          );
        }
      });
    }

    // ── HISTORY — editorial scroll unfold (alternating clip) ──
    const history = document.querySelector<HTMLElement>('#sejarah');
    const histHeader = document.querySelector<HTMLElement>('.history-section__header');
    const histEntries = document.querySelectorAll<HTMLElement>('.history-editorial__entry');
    const histFestival = document.querySelector<HTMLElement>('.history-festival');

    if (histHeader && history) {
      gsap.set(histHeader, { y: 28, opacity: 0, clipPath: 'inset(0 0 100% 0)' });
      track(
        gsap.to(histHeader, {
          y: 0,
          opacity: 1,
          clipPath: 'inset(0 0 0% 0)',
          ease: 'none',
          scrollTrigger: { trigger: history, start: 'top 84%', end: 'top 48%', scrub: 1.1 },
        }),
      );
    }
    histEntries.forEach((entry) => {
      const isFlip = entry.classList.contains('history-editorial__entry--flip');
      const body = entry.querySelector<HTMLElement>('.history-editorial__body');
      const numeral = entry.querySelector<HTMLElement>('.history-editorial__numeral');
      gsap.set(entry, { opacity: 1 });
      gsap.set(entry, { clipPath: isFlip ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' , y: 18, scale: 0.98 });
      if (numeral) gsap.set(numeral, { y: 24, opacity: 0, scale: 0.9 });
      if (body) gsap.set(body, { y: 18, opacity: 0 });
      track(
        gsap.to(entry, {
          clipPath: 'inset(0 0% 0 0%)',
          y: 0,
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: entry, start: 'top 90%', end: 'top 56%', scrub: 1.2 },
        }),
      );
      if (body) {
        track(
          gsap.to(body, {
            y: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: entry, start: 'top 88%', end: 'top 60%', scrub: 1 },
          }),
        );
      }
      if (numeral) {
        track(
          gsap.to(numeral, {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'none',
            scrollTrigger: { trigger: entry, start: 'top 88%', end: 'top 62%', scrub: 1 },
          }),
        );
      }
    });
    if (histFestival) {
      gsap.set(histFestival, { y: 36, scale: 0.96, opacity: 0, clipPath: 'inset(8% 4% 8% 4% round 1.2rem)' } as unknown as object);
      track(
        gsap.to(histFestival, {
          y: 0,
          scale: 1,
          opacity: 1,
          clipPath: 'inset(0% 0% 0% 0% round 1.2rem)',
          ease: 'none',
          scrollTrigger: { trigger: histFestival, start: 'top 90%', end: 'top 52%', scrub: 1.2 },
        }),
      );
    }

    // ── PARTNERS — tier grid mech deploy ──
    const partners = document.querySelector<HTMLElement>('.partner-section');
    const pHeader = document.querySelector<HTMLElement>('.partner-section__header');
    const pTiers = document.querySelectorAll<HTMLElement>('.partner-tier, .partner-section__tiers > div');
    const pAnnouncement = document.querySelector<HTMLElement>('.partner-announcement');

    if (pHeader && partners) {
      gsap.set(pHeader, { y: 26, opacity: 0, clipPath: 'inset(0 0 100% 0)' });
      track(gsap.to(pHeader, { y: 0, opacity: 1, clipPath: 'inset(0 0 0% 0)', ease: 'none', scrollTrigger: { trigger: partners, start: 'top 84%', end: 'top 50%', scrub: 1.1 } }));
    }
    if (pTiers.length && partners) {
      pTiers.forEach((tier) => {
        gsap.set(tier, { y: 20, opacity: 0, clipPath: 'inset(0 100% 0 0)', scale: 0.98 });
        track(gsap.to(tier, { y: 0, opacity: 1, clipPath: 'inset(0 0% 0 0)', scale: 1, ease: 'none', scrollTrigger: { trigger: tier, start: 'top 92%', end: 'top 64%', scrub: 1 } }));
      });
    }
    if (pAnnouncement) {
      gsap.set(pAnnouncement, { y: 22, opacity: 0, scale: 0.97 });
      track(gsap.to(pAnnouncement, { y: 0, opacity: 1, scale: 1, ease: 'none', scrollTrigger: { trigger: pAnnouncement, start: 'top 92%', end: 'top 66%', scrub: 1 } }));
    }

    // ── LEGACY WORLD — one archive → forum → inner-court chapter ──
    const legacy = document.querySelector<HTMLElement>('[data-legacy-world]');
    if (legacy) {
      const plate = legacy.querySelector<HTMLElement>('.legacy-world__plate');
      const standards = legacy.querySelectorAll<HTMLElement>('.legacy-world__standard');
      const archive = legacy.querySelector<HTMLElement>('.legacy-world__archive-frame');
      const forum = legacy.querySelector<HTMLElement>('.legacy-world__forum-gate');
      const columns = legacy.querySelectorAll<HTMLElement>('.legacy-world__columns');
      const chapter = gsap.timeline({ scrollTrigger: { trigger: legacy, start: 'top 78%', end: 'bottom 35%', scrub: 1.35 } });
      if (plate) chapter.fromTo(plate, { yPercent: -1 }, { yPercent: 18, ease: 'none' }, 0);
      chapter.fromTo(legacy, { ['--legacy-dusk' as string]: 0 }, { ['--legacy-dusk' as string]: 1, ease: 'none' }, 0);
      if (archive) chapter.fromTo(archive, { yPercent: 24, opacity: .35 }, { yPercent: -12, opacity: 1, ease: 'none' }, .08);
      if (standards.length) chapter.fromTo(standards, { rotate: (i) => i ? -1.2 : 1.2, yPercent: -3 }, { rotate: (i) => i ? .8 : -.8, yPercent: 8, ease: 'none' }, .2);
      if (forum) chapter.fromTo(forum, { clipPath: 'inset(48% 12% 48% 12%)', scaleX: .88, opacity: .25 }, { clipPath: 'inset(0% 0% 0% 0%)', scaleX: 1, opacity: 1, ease: 'none' }, .38);
      if (columns.length) chapter.fromTo(columns, { xPercent: (i) => i ? 18 : -18, opacity: .25 }, { xPercent: 0, opacity: .8, ease: 'none' }, .58);
      track(chapter);
    }

    // ── FAQ — scan reveal ──
    const faq = document.querySelector<HTMLElement>('#informasi');
    const faqHeader = document.querySelector<HTMLElement>('.faq-section__header');
    const faqItems = document.querySelectorAll<HTMLElement>('.faq-item');
    if (faqHeader && faq) {
      gsap.set(faqHeader, { y: 26, opacity: 0, clipPath: 'inset(0 0 100% 0)' });
      track(gsap.to(faqHeader, { y: 0, opacity: 1, clipPath: 'inset(0 0 0% 0)', ease: 'none', scrollTrigger: { trigger: faq, start: 'top 84%', end: 'top 50%', scrub: 1.1 } }));
    }
    faqItems.forEach((item) => {
      gsap.set(item, { y: 16, opacity: 0, clipPath: 'inset(0 100% 0 0)' });
      track(gsap.to(item, { y: 0, opacity: 1, clipPath: 'inset(0 0% 0 0)', ease: 'none', scrollTrigger: { trigger: item, start: 'top 94%', end: 'top 72%', scrub: 1 } }));
    });

    // ── CTA — gate arch draw + HUD lift ──
    const cta = document.querySelector<HTMLElement>('.cta-section');
    const ctaInner = document.querySelector<HTMLElement>('.cta-section__inner');
    const ctaGate = document.querySelector<HTMLElement>('.cta-gate');
    const ctaEdition = document.querySelector<HTMLElement>('.cta-section__edition');
    const ctaActions = document.querySelector<HTMLElement>('.cta-section__actions');
    const ctaEmbers = document.querySelectorAll<HTMLElement>('.cta-ember');

    if (cta && ctaInner) {
      gsap.set(ctaInner, { y: 40, opacity: 0, scale: 0.96, clipPath: 'inset(12% 6% 12% 6% round 1rem)' } as unknown as object);
      track(gsap.to(ctaInner, { y: 0, opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 1rem)', ease: 'none', scrollTrigger: { trigger: cta, start: 'top 80%', end: 'top 36%', scrub: 1.2 } }));
    }
    if (ctaActions && cta) {
      gsap.set(ctaActions, { y: 18, opacity: 0 });
      track(gsap.to(ctaActions, { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: cta, start: 'top 48%', end: 'top 22%', scrub: 1 } }));
    }
    if (ctaGate && cta) {
      track(gsap.fromTo(ctaGate, { y: 50, scale: 0.94, opacity: 0.55 }, { y: -18, scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: cta, start: 'top 86%', end: 'bottom 50%', scrub: 1.4 } }));
    }
    if (ctaEdition && cta) {
      track(gsap.fromTo(ctaEdition, { y: 30, opacity: 0.2, scale: 0.92 }, { y: -30, opacity: 0.5, scale: 1, ease: 'none', scrollTrigger: { trigger: cta, start: 'top 82%', end: 'bottom top', scrub: 1.6 } }));
    }
    ctaEmbers.forEach((ember, i) => {
      track(gsap.fromTo(ember, { y: 0, opacity: 0.7 }, { y: -80 - i * 16, opacity: 1, ease: 'none', scrollTrigger: { trigger: cta!, start: 'top 84%', end: 'bottom top', scrub: 1.5 } }));
    });

    ScrollTrigger.refresh();

    return () => {
      triggers.forEach((t) => t.kill());
      tweens.forEach((t) => t.kill());
      timelines.forEach((t) => t.kill());
      const all = Array.from(
        document.querySelectorAll(
          '.hero-section__content, .hero-section__visual, .hero-section__shade, .hero-section__theme, .hero-section__title-lockup h1, .arena-facts__edition, .arena-facts__section-label, .arena-facts__title, .arena-facts__fact, .character-selector__eyebrow, .character-selector__stage, .character-selector__portal, .character-selector__name, .character-selector__footer, .schedule-section__header, .schedule-via__path, .schedule-via__card, .schedule-via__node, .history-section__header, .history-editorial__entry, .history-editorial__body, .history-editorial__numeral, .history-festival, .legacy-world__plate, .legacy-world__standard, .legacy-world__forum-gate, .legacy-world__columns, .partner-section__header, .partner-tier, .partner-announcement, .faq-section__header, .faq-item, .cta-section__inner, .cta-section__actions, .cta-gate, .cta-section__edition',
        ),
      ) as Element[];
      if (all.length) gsap.set(all, { clearProps: 'all' });
      const trackEl = document.getElementById('schedule-via-track');
      if (trackEl) gsap.set(trackEl, { clearProps: 'strokeDashoffset,strokeDasharray' });
      document.querySelectorAll<HTMLElement>('.arena-facts__fact').forEach((el) => el.style.removeProperty('--fact-line'));
    };
  }, [disabled]);
}

export default useScrubTransitions;
