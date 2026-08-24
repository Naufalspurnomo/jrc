import { Link } from 'react-router-dom';

export function SiteFooter() {
  return (
    <footer className="footer-section">
      <div className="footer-watermark" aria-hidden="true">XIV</div>
      <div className="site-shell page-shell footer-section__inner">
        <div className="footer-section__signature">
          <picture>
            <source
              srcSet="/assets/brand/jrc14-logo-transparent-128.webp 128w, /assets/brand/jrc14-logo-transparent-256.webp 256w"
              sizes="(max-width: 48rem) 84px, 96px"
              type="image/webp"
            />
            <img
              className="footer-section__logo"
              src="/assets/brand/jrc14-logo-transparent-128.webp"
              alt="JRC 14"
              width="128"
              height="221"
              decoding="async"
            />
          </picture>
          <span>Imperium Machina</span>
        </div>

        <div className="footer-section__manifesto">
          <p>Java Robot Contest</p>
          <span>Kompetisi robotika oleh Politeknik Elektronika Negeri Surabaya.</span>
          <span className="footer-section__location">Kampus PENS, Surabaya, Indonesia</span>
        </div>

        <nav aria-label="Navigasi footer">
          <a href="/#perlombaan">Perlombaan</a>
          <a href="/#jadwal">Jadwal</a>
          <a href="/#sejarah">Sejarah</a>
          <a href="/#informasi">Informasi</a>
          <Link to="/portal/masuk">Demo portal peserta</Link>
        </nav>

        <div className="footer-section__legal">
          <span>© {new Date().getFullYear()} Java Robot Contest</span>
          <a className="footer-section__attribution" href="/assets/roman-select/ATTRIBUTION.md">
            Atribusi aset
          </a>
          <span>Surabaya, Indonesia</span>
        </div>
      </div>
    </footer>
  );
}
