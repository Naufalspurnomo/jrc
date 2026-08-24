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

export default function HomePage() {
  return (
    <div className="site-page site-page--home">
      <ResponsiveMotionController />
      <a className="site-skip-link skip-link" href="#main-content">
        Lewati ke konten utama
      </a>
      <SiteHeader />
      <main id="main-content">
        <HeroSection />
        <EventFacts />
        <ShowcaseHero />
        <ScheduleSection />
        <LegacyWorld />
        <FAQSection />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}
