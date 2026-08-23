import { partnerTiers, pendingAnnouncement } from '../../content/jrc';

const TIER_ICONS: Record<string, string> = {
  'Platinum': 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z',
  'Gold': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  'Silver': 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
};

export function PartnersSection() {
  return (
    <section className="partner-section" aria-labelledby="partner-title">
      <div className="site-shell page-shell">
        <header className="partner-section__header">
          <p className="site-kicker kicker">Societas</p>
          <h2 id="partner-title">Mereka yang membantu arena berdiri.</h2>
          <p>
            Identitas partner hanya akan ditampilkan setelah kerja sama resmi. Tidak ada logo
            sementara dan tidak ada klaim yang dibuat-buat.
          </p>
        </header>

        <dl className="partner-section__tiers">
          {partnerTiers.map((tier, index) => (
            <div key={tier} className="partner-tier">
              <dt>
                <span className="partner-tier__num" aria-hidden="true">0{index + 1}</span>
                <svg className="partner-tier__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={TIER_ICONS[tier] || TIER_ICONS['Silver']} />
                </svg>
                {tier}
              </dt>
              <dd>{pendingAnnouncement}</dd>
            </div>
          ))}
        </dl>

        {/* Announcement card */}
        <div className="partner-announcement">
          <div className="partner-announcement__inner">
            <span className="partner-announcement__label">Terbuka untuk kolaborasi</span>
            <p>Hubungi panitia JRC XIV untuk menjadi bagian dari arena ini.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
