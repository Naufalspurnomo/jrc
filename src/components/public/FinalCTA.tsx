import { Link } from 'react-router-dom';

export function FinalCTA() {
  return (
    <section className="cta-section" aria-labelledby="cta-title">
      <div className="cta-section__atmosphere" aria-hidden="true">
        {/* Roman gate arch */}
        <svg className="cta-gate" viewBox="0 0 400 500" fill="none" aria-hidden="true">
          <rect x="40" y="120" width="30" height="380" fill="rgb(215 166 59 / 6%)" rx="2" />
          <rect x="330" y="120" width="30" height="380" fill="rgb(215 166 59 / 6%)" rx="2" />
          <path d="M70 120 Q200 -20 330 120" stroke="rgb(215 166 59 / 12%)" strokeWidth="2" fill="none" />
          <path d="M70 120 Q200 10 330 120" stroke="rgb(215 166 59 / 8%)" strokeWidth="1" fill="none" />
          <line x1="70" y1="120" x2="330" y2="120" stroke="rgb(215 166 59 / 10%)" strokeWidth="1" />
        </svg>
        {/* Floating embers */}
        <span className="cta-ember cta-ember--1" />
        <span className="cta-ember cta-ember--2" />
        <span className="cta-ember cta-ember--3" />
        <span className="cta-ember cta-ember--4" />
        <span className="cta-ember cta-ember--5" />
      </div>
      <div className="site-shell page-shell cta-section__inner">
        <p className="site-kicker kicker">The arena awaits</p>
        <h2 id="cta-title">
          <span>Ketika gerbang terbuka,</span>
          <strong>masuki arena.</strong>
        </h2>
        <p>
          Susun timmu sekarang. Portal demo sudah dapat dijelajahi sambil menunggu pengumuman
          resmi JRC XIV.
        </p>
        <div className="cta-section__actions">
          <Link className="site-action site-action--primary button-primary" to="/portal/masuk">
            Buka portal peserta
            <span aria-hidden="true">↗</span>
          </Link>
          <a className="site-action site-action--quiet button-secondary" href="#perlombaan">
            Pelajari enam arena
          </a>
        </div>
        <span className="cta-section__edition" aria-hidden="true">
          XIV
        </span>
      </div>
    </section>
  );
}
