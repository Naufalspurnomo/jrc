import { Link, Navigate, useNavigate } from 'react-router-dom';
import { PortalShell } from '../../components/portal/PortalShell';
import { StatusBadge } from '../../components/portal/StatusBadge';
import { portalRepository, type PortalRepository, type Registration } from '../../data/portal';

interface PortalDashboardPageProps {
  repository?: PortalRepository;
}

const completion = (registration: Registration) => {
  const checkpoints = [
    Boolean(registration.teamName.trim()),
    Boolean(registration.institution.trim()),
    Boolean(registration.competitionId),
    registration.members.length > 0,
    registration.documents.length > 0,
  ];
  return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100);
};

export default function PortalDashboardPage({ repository = portalRepository }: PortalDashboardPageProps) {
  const navigate = useNavigate();
  const session = repository.getSession();
  if (!session || session.role !== 'participant' || !session.registrationId) {
    return <Navigate replace to="/portal/masuk" />;
  }
  const registration = repository.getRegistration(session.registrationId);
  if (!registration) return <Navigate replace to="/portal/masuk" />;
  const progress = completion(registration);

  const signOut = () => {
    repository.endSession();
    navigate('/portal/masuk');
  };

  return (
    <PortalShell onSignOut={signOut}>
      <main className="portal-main">
        <section className="portal-hero" aria-labelledby="portal-dashboard-title">
          <div>
            <p className="portal-eyebrow">LEGIO · {registration.id.toUpperCase()}</p>
            <h1 id="portal-dashboard-title">{registration.teamName}</h1>
            <p>{registration.institution} bersiap memasuki arena JRC XIV.</p>
          </div>
          <StatusBadge status={registration.status} />
        </section>

        <section className="portal-dashboard-grid" aria-label="Ringkasan pendaftaran">
          <article className="portal-progress-panel">
            <div className="portal-panel-heading">
              <div>
                <p className="portal-eyebrow">KELENGKAPAN LEGION</p>
                <h2>Persiapan pendaftaran</h2>
              </div>
              <strong>{progress}%</strong>
            </div>
            <div
              className="portal-progress"
              role="progressbar"
              aria-label="Kelengkapan pendaftaran"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>
              {progress === 100
                ? 'Seluruh data wajib telah lengkap.'
                : 'Lengkapi anggota dan dokumen untuk membuka tahap pengiriman.'}
            </p>
            <Link className="portal-button portal-button--primary" to="/portal/pendaftaran">
              Lanjutkan pendaftaran <span aria-hidden="true">→</span>
            </Link>
          </article>

          <article className="portal-summary-panel">
            <p className="portal-eyebrow">TABULA REGISTRATIONIS</p>
            <dl>
              <div><dt>Arena</dt><dd>{registration.competitionId || 'Belum dipilih'}</dd></div>
              <div><dt>Anggota</dt><dd>{registration.members.length} orang</dd></div>
              <div><dt>Dokumen</dt><dd>{registration.documents.length} berkas</dd></div>
              <div><dt>Pembaruan</dt><dd>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(registration.updatedAt))}</dd></div>
            </dl>
          </article>
        </section>

        <section className="portal-notice" aria-labelledby="portal-notice-title">
          <span className="portal-notice__number" aria-hidden="true">I</span>
          <div>
            <p className="portal-eyebrow">AMANAT PANITIA</p>
            <h2 id="portal-notice-title">Pastikan identitas tim sesuai dokumen.</h2>
            <p>Prototype ini tidak mengirim berkas ke server. Metadata disimpan pada peramban lokal.</p>
          </div>
        </section>
      </main>
    </PortalShell>
  );
}
