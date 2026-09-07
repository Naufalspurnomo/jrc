import { useEffect, useState, type ComponentProps } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { PaymentStatusNotice } from '../../components/portal/PaymentStatusNotice';
import { PortalShell } from '../../components/portal/PortalShell';
import { StatusBadge } from '../../components/portal/StatusBadge';
import { useAuth } from '../../features/auth/AuthProvider';
import {
  registrationApi,
  type RegistrationApi,
  type RegistrationRecord,
  type RegistrationState,
} from '../../features/registration/api';

interface PortalDashboardPageProps {
  api?: RegistrationApi;
}

type StatusBadgeState = ComponentProps<typeof StatusBadge>['status'];

const statusBadgeStates: Record<RegistrationState, StatusBadgeState> = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  REVISION_REQUESTED: 'revision_requested',
  APPROVED: 'verified',
  REJECTED: 'rejected',
  CANCELLED: 'rejected',
};

function canContinueRegistration(status: RegistrationState): boolean {
  return status === 'DRAFT' || status === 'REVISION_REQUESTED';
}

export default function PortalDashboardPage({ api = registrationApi }: PortalDashboardPageProps) {
  const navigate = useNavigate();
  const { loading: authLoading, logout, user } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (authLoading || !user || user.role !== 'PARTICIPANT') return undefined;

    let active = true;
    setLoading(true);
    setError(false);

    void api.registrations.list()
      .then((records) => {
        if (active) setRegistrations(records);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, authLoading, user]);

  if (authLoading) {
    return (
      <PortalShell>
        <main className="portal-main">
          <section className="portal-notice" role="status">
            <span className="portal-notice__number" aria-hidden="true">XIV</span>
            <div>
              <p className="portal-eyebrow">PORTA PARTICIPANTIUM</p>
              <h1>Memuat portal peserta…</h1>
            </div>
          </section>
        </main>
      </PortalShell>
    );
  }

  if (!user || user.role !== 'PARTICIPANT') {
    return <Navigate replace to="/portal/masuk" />;
  }

  const signOut = async () => {
    try {
      await logout();
    } finally {
      navigate('/portal/masuk');
    }
  };

  return (
    <PortalShell onSignOut={() => void signOut()}>
      <main className="portal-main">
        <section className="portal-hero" aria-labelledby="portal-dashboard-title">
          <div>
            <p className="portal-eyebrow">SALVE, PARTICIPANT</p>
            <h1 id="portal-dashboard-title">{user.displayName}</h1>
            <p>Pantau seluruh tim dan tahapan pendaftaran JRC XIV dalam satu tempat.</p>
          </div>
          {!loading && !error && registrations.length > 0 && (
            <Link className="portal-button portal-button--primary" to="/portal/pendaftaran/baru">
              Buat pendaftaran
            </Link>
          )}
        </section>

        {loading && (
          <section className="portal-notice" role="status">
            <span className="portal-notice__number" aria-hidden="true">I</span>
            <div>
              <p className="portal-eyebrow">TABULA REGISTRATIONIS</p>
              <h2>Memuat pendaftaran…</h2>
              <p>Data tim sedang disiapkan.</p>
            </div>
          </section>
        )}

        {!loading && error && (
          <section className="portal-notice" role="alert">
            <span className="portal-notice__number" aria-hidden="true">!</span>
            <div>
              <p className="portal-eyebrow">TABULA REGISTRATIONIS</p>
              <h2>Pendaftaran gagal dimuat.</h2>
              <p>Muat ulang halaman atau coba lagi beberapa saat lagi.</p>
            </div>
          </section>
        )}

        {!loading && !error && registrations.length === 0 && (
          <section className="portal-notice" aria-labelledby="empty-registration-title">
            <span className="portal-notice__number" aria-hidden="true">I</span>
            <div>
              <p className="portal-eyebrow">TABULA REGISTRATIONIS</p>
              <h2 id="empty-registration-title">Belum ada pendaftaran.</h2>
              <p>Daftarkan tim pertama Anda untuk memasuki arena JRC XIV.</p>
              <Link className="portal-button portal-button--primary" to="/portal/pendaftaran/baru">
                Buat pendaftaran
              </Link>
            </div>
          </section>
        )}

        {!loading && !error && registrations.length > 0 && (
          <section className="portal-dashboard-grid" aria-label="Daftar pendaftaran">
            {registrations.map((registration) => {
              const paymentStatus = registration.paymentStatus ?? registration.invoice?.paymentStatus;
              const detailPath = `/portal/pendaftaran/${registration.id}`;

              return (
                <article className="portal-progress-panel" key={registration.id}>
                  <div className="portal-panel-heading">
                    <div>
                      <p className="portal-eyebrow">{registration.registrationNumber}</p>
                      <h2>{registration.teamName}</h2>
                    </div>
                    <StatusBadge status={statusBadgeStates[registration.status]} />
                  </div>

                  <p>
                    Kompetisi: <strong>{registration.competition?.name ?? registration.competitionId}</strong>
                  </p>

                  {paymentStatus && <PaymentStatusNotice status={paymentStatus} />}

                  <div>
                    <Link className="portal-button portal-button--primary" to={detailPath}>
                      {canContinueRegistration(registration.status) ? 'Lanjutkan' : 'Lihat pendaftaran'}{' '}
                      {registration.teamName} <span aria-hidden="true">→</span>
                    </Link>
                    {paymentStatus && (
                      <Link className="portal-button" to={`${detailPath}/pembayaran`}>
                        Pembayaran {registration.teamName}
                      </Link>
                    )}
                    {(registration.ticketStatus === 'ACTIVE'
                      || registration.ticketStatus === 'CHECKED_IN'
                      || registration.ticket?.status === 'ACTIVE'
                      || registration.ticket?.status === 'CHECKED_IN') && (
                      <Link className="portal-button" to={`${detailPath}/tiket`}>
                        Tiket {registration.teamName}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </PortalShell>
  );
}
