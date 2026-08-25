import { lazy, Suspense, useEffect, useState } from 'react';

import { EventFacts } from '../components/public/EventFacts';
import { FAQSection } from '../components/public/FAQSection';
import { FinalCTA } from '../components/public/FinalCTA';
import { HeroSection } from '../components/public/HeroSection';
import { LegacyWorld } from '../components/public/LegacyWorld';
import { ScheduleSection } from '../components/public/ScheduleSection';
import { ShowcaseHero } from '../components/public/ShowcaseHero';
import { SiteFooter } from '../components/public/SiteFooter';
import { SiteHeader } from '../components/public/SiteHeader';
import { ResponsiveMotionController } from '../components/motion/ResponsiveMotionController';

const DesktopMotionController = lazy(() => import('../components/motion/DesktopMotionController'));

function DesktopMotionLoader() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compactLayout = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
    if (reducedMotion || compactLayout) return undefined;

    const timer = window.setTimeout(() => setIsReady(true), 350);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isReady) return null;

  return (
    <Suspense fallback={null}>
      <DesktopMotionController />
    </Suspense>
  );
}

export default function HomePage() {
  return (
    <div className="site-page site-page--home">
      <ResponsiveMotionController />
      <DesktopMotionLoader />
      <a className="site-skip-link skip-link" href="#main-content">
        Lewati ke konten utama
      </a>
      <SiteHeader />
      <main id="main-content">
        <HeroSection />
        <EventFacts />
        <ShowcaseHero />
        <ScheduleSection />
        <div className="lower-world" aria-label="Perjalanan, informasi, dan penutup Java Robot Contest">
          <LegacyWorld />
          <FAQSection />
        </div>
        <FinalCTA />
        <SiteFooter />
      </main>
    </div>
  );
}
