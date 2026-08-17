import { Link } from 'react-router-dom';

export function FinalCTA() {
  return (
    <section className="cta-section" aria-labelledby="cta-title">
      <div className="cta-section__atmosphere" aria-hidden="true" />
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
