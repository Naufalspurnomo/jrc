import { CompetitionExplorer } from '../components/public/CompetitionExplorer';
import { EventFacts } from '../components/public/EventFacts';
import { FAQSection } from '../components/public/FAQSection';
import { FinalCTA } from '../components/public/FinalCTA';
import { HeroSection } from '../components/public/HeroSection';
import { HistorySection } from '../components/public/HistorySection';
import { PartnersSection } from '../components/public/PartnersSection';
import { ScheduleSection } from '../components/public/ScheduleSection';
import { SiteFooter } from '../components/public/SiteFooter';
import { SiteHeader } from '../components/public/SiteHeader';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function HomePage() {
  useScrollReveal();

  return (
    <div className="site-page site-page--home">
      <a className="site-skip-link skip-link" href="#main-content">
        Lewati ke konten utama
      </a>
      <SiteHeader />
      <main id="main-content">
        <HeroSection />
        <EventFacts />
        <CompetitionExplorer />
        <ScheduleSection />
        <HistorySection />
        <PartnersSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}
