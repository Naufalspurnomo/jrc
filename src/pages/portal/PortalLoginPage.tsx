import { Link, useNavigate } from 'react-router-dom';
import { portalRepository, type PortalRepository } from '../../data/portal';

interface PortalLoginPageProps {
  repository?: PortalRepository;
}

export default function PortalLoginPage({ repository = portalRepository }: PortalLoginPageProps) {
  const navigate = useNavigate();
  const enterDemo = () => {
    repository.startSession({
      role: 'participant',
      name: 'Aurora Mechanica',
      registrationId: 'reg-aurora',
    });
    navigate('/portal');
  };

  return (
    <main className="portal-auth">
      <section className="portal-auth__scene" aria-labelledby="portal-login-title">
        <div className="portal-auth__crest" aria-hidden="true">XIV</div>
        <p className="portal-eyebrow">PORTA PARTICIPANTIUM · DEMO LOKAL</p>
        <h1 id="portal-login-title" aria-label="Portal peserta — Masuki portal para penantang">
          Masuki portal<br />para penantang.
        </h1>
        <p className="portal-auth__lead">
          Susun legiunmu, pilih arena, lalu tuntaskan berkas sebelum genderang pertandingan berbunyi.
        </p>
        <button className="portal-button portal-button--primary" type="button" onClick={enterDemo}>
          Masuk sebagai peserta
          <span aria-hidden="true">→</span>
        </button>
        <p className="portal-auth__note">Data tersimpan hanya di peramban perangkat ini.</p>
      </section>

      <aside className="portal-auth__aside" aria-label="Informasi portal">
        <p className="portal-eyebrow">JRC XIV · IMPERIUM MACHINA</p>
        <blockquote>“Fortuna audaces iuvat.”</blockquote>
        <dl className="portal-auth__facts">
          <div><dt>Mode</dt><dd>Prototype lokal</dd></div>
          <div><dt>Musim</dt><dd>JRC XIV</dd></div>
          <div><dt>Pembayaran</dt><dd>Belum tersedia</dd></div>
        </dl>
        <Link className="portal-text-link" to="/">Kembali ke arena publik</Link>
      </aside>
    </main>
  );
}
