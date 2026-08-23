import { Link } from 'react-router-dom';

export function SiteFooter() {
  return (
    <footer className="footer-section">
      <div className="footer-watermark" aria-hidden="true">XIV</div>
      <div className="site-shell page-shell footer-section__inner">
        <div className="footer-section__signature">
          <p>JRC</p>
          <strong>XIV</strong>
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
          <Link to="/portal/masuk">Portal peserta</Link>
        </nav>

        <div className="footer-section__legal">
          <span>© {new Date().getFullYear()} Java Robot Contest</span>
          <span>Surabaya, Indonesia</span>
        </div>
      </div>
    </footer>
  );
}
