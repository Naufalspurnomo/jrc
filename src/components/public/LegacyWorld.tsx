import { HistorySection } from './HistorySection';
import { PartnersSection } from './PartnersSection';

export function LegacyWorld() {
  return (
    <div className="legacy-world" aria-label="Perjalanan, festival, dan kolaborasi JRC">
      <div className="legacy-world__plate" aria-hidden="true" />
      <div className="legacy-world__light" aria-hidden="true" />
      <div className="legacy-world__content">
        <HistorySection />
        <PartnersSection />
      </div>
    </div>
  );
}
