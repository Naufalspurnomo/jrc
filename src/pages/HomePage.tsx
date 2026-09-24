import { lazy, Suspense, useEffect, useState } from 'react';

import { EventFacts } from '../components/public/EventFacts';
import { FAQSection } from '../components/public/FAQSection';
import { FinalCTA } from '../components/public/FinalCTA';
import { HeroSection } from '../components/public/HeroSection';
import { JourneyThread } from '../components/public/JourneyThread';
import { LegacyWorld } from '../components/public/LegacyWorld';
import { ScheduleSection } from '../components/public/ScheduleSection';
import { ShowcaseHero } from '../components/public/ShowcaseHero';
import { SiteFooter } from '../components/public/SiteFooter';
import { SiteHeader } from '../components/public/SiteHeader';
import { ResponsiveMotionController } from '../components/motion/ResponsiveMotionController';

const DesktopMotionController = lazy(() => import('../components/motion/DesktopMotionController'));

function DesktopMotionLoader({ startupReady, narrativeReady }: { startupReady: boolean; narrativeReady: boolean }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const reducedMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compactMedia = window.matchMedia('(max-width: 64rem)');
    const hoverMedia = window.matchMedia('(hover: hover)');
    const pointerMedia = window.matchMedia('(pointer: fine)');
    let frame = 0;
    const sync = () => {
      window.cancelAnimationFrame(frame);
      if (!startupReady || !narrativeReady || reducedMedia.matches || compactMedia.matches || !hoverMedia.matches || !pointerMedia.matches) {
        setIsReady(false);
        return;
      }
      frame = window.requestAnimationFrame(() => setIsReady(true));
    };
    sync();
    reducedMedia.addEventListener('change', sync);
    compactMedia.addEventListener('change', sync);
    hoverMedia.addEventListener('change', sync);
    pointerMedia.addEventListener('change', sync);
    return () => {
      window.cancelAnimationFrame(frame);
      reducedMedia.removeEventListener('change', sync);
      compactMedia.removeEventListener('change', sync);
      hoverMedia.removeEventListener('change', sync);
      pointerMedia.removeEventListener('change', sync);
    };
  }, [narrativeReady, startupReady]);

  if (!isReady) return null;

  return (
    <Suspense fallback={null}>
      <DesktopMotionController />
    </Suspense>
  );
}

export default function HomePage({ startupReady = true }: { startupReady?: boolean }) {
  const [narrativeReady, setNarrativeReady] = useState(startupReady);

  useEffect(() => {
    if (!startupReady || narrativeReady) return undefined;

    const reveal = () => setNarrativeReady(true);
    const timer = window.setTimeout(reveal, 450);
    window.addEventListener('wheel', reveal, { passive: true, once: true });
    window.addEventListener('touchmove', reveal, { passive: true, once: true });
    window.addEventListener('keydown', reveal, { passive: true, once: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('wheel', reveal);
      window.removeEventListener('touchmove', reveal);
      window.removeEventListener('keydown', reveal);
    };
  }, [narrativeReady, startupReady]);

  return (
    <div className="site-page site-page--home">
      {startupReady && narrativeReady ? <ResponsiveMotionController /> : null}
      <DesktopMotionLoader startupReady={startupReady} narrativeReady={narrativeReady} />
      <a className="site-skip-link skip-link" href="#main-content">
        Lewati ke konten utama
      </a>
      <SiteHeader />
      <main id="main-content">
        <HeroSection startupReady={startupReady} />
        {narrativeReady ? (
          <>
            <EventFacts />
            <ShowcaseHero />
            <ScheduleSection />
            <div className="lower-world" aria-label="Perjalanan, informasi, dan penutup Java Robot Contest">
              <LegacyWorld />
              <FAQSection />
              <JourneyThread />
            </div>
            <FinalCTA />
            <SiteFooter />
          </>
        ) : null}
      </main>
    </div>
  );
}
