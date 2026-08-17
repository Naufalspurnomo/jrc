import { partnerTiers, pendingAnnouncement } from '../../content/jrc';

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
            <div key={tier}>
              <dt>
                <span aria-hidden="true">0{index + 1}</span>
                {tier}
              </dt>
              <dd>{pendingAnnouncement}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
