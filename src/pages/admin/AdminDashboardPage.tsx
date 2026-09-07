import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Link } from 'react-router-dom';

import { AdminShell } from '../../components/portal/AdminShell';
import { StatusBadge } from '../../components/portal/StatusBadge';
import { useAuth } from '../../features/auth';
import {
  registrationApi,
  type RegistrationApi,
  type RegistrationRecord,
  type RegistrationState,
} from '../../features/registration/api';

interface AdminDashboardPageProps {
  api?: RegistrationApi;
}

type StatusBadgeState = ComponentProps<typeof StatusBadge>['status'];
type StatusFilter = RegistrationState | 'ALL';

const statusBadgeStates: Record<RegistrationState, StatusBadgeState> = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  REVISION_REQUESTED: 'revision_requested',
  APPROVED: 'verified',
  REJECTED: 'rejected',
  CANCELLED: 'rejected',
};

const statusLabels: Record<RegistrationState, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Terkirim',
  UNDER_REVIEW: 'Dalam review',
  REVISION_REQUESTED: 'Perlu revisi',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

const registrationStates = Object.keys(statusLabels) as RegistrationState[];

function normalized(value: string | null | undefined): string {
  return value?.toLocaleLowerCase('id-ID') ?? '';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

async function downloadCsv(api: RegistrationApi): Promise<void> {
  const csv = await api.admin.exportRegistrations();
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pendaftaran-jrc-xiv.csv';

  try {
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AdminDashboardPage({ api = registrationApi }: AdminDashboardPageProps) {
  const { loading: authLoading, user } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return undefined;

    let active = true;
    setLoading(true);
    setLoadError(false);

    void api.admin.listRegistrations()
      .then((records) => {
        if (active) setRegistrations(Array.isArray(records) ? records : []);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, authLoading, requestVersion, user]);

  const filteredRegistrations = useMemo(() => {
    const search = normalized(query.trim());
    return registrations.filter((registration) => {
      if (status !== 'ALL' && registration.status !== status) return false;
      if (!search) return true;
      return [
        registration.registrationNumber,
        registration.teamName,
        registration.institution,
        registration.competition?.name,
      ].some((value) => normalized(value).includes(search));
    });
  }, [query, registrations, status]);

  const exportRecords = async () => {
    setExporting(true);
    setExportError('');
    try {
      await downloadCsv(api);
    } catch {
      setExportError('Ekspor CSV gagal. Coba lagi beberapa saat lagi.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminShell>
      <main className="admin-main">
        <header className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">TABULARIUM · XIV</p>
            <h1>Meja komando pendaftaran</h1>
          </div>
          <button
            className="admin-export"
            type="button"
            disabled={loading || exporting}
            onClick={() => void exportRecords()}
          >
            {exporting ? 'Menyiapkan CSV…' : 'Ekspor CSV'}
          </button>
        </header>
        {exportError && <p className="admin-error" role="alert">{exportError}</p>}

        {!loading && !loadError && (
          <section className="admin-metrics" aria-label="Ringkasan status">
            <article><span>Total tim</span><strong>{registrations.length}</strong><small>seluruh pendaftaran</small></article>
            <article><span>Menanti telaah</span><strong>{registrations.filter((item) => item.status === 'SUBMITTED').length}</strong><small>siap diperiksa</small></article>
            <article><span>Dalam review</span><strong>{registrations.filter((item) => item.status === 'UNDER_REVIEW').length}</strong><small>di meja panitia</small></article>
            <article><span>Disetujui</span><strong>{registrations.filter((item) => item.status === 'APPROVED').length}</strong><small>lolos administrasi</small></article>
          </section>
        )}

        {loading && (
          <section className="admin-register admin-empty" role="status">
            <h2>Memuat pendaftaran…</h2>
            <p>Data tim sedang disiapkan.</p>
          </section>
        )}

        {!loading && loadError && (
          <section className="admin-register admin-empty" role="alert">
            <h2>Pendaftaran gagal dimuat.</h2>
            <p>Periksa koneksi, lalu coba lagi.</p>
            <button className="admin-action" type="button" onClick={() => setRequestVersion((value) => value + 1)}>
              Coba lagi
            </button>
          </section>
        )}

        {!loading && !loadError && (
          <section className="admin-register" aria-labelledby="admin-register-title">
            <div className="admin-register__heading">
              <div>
                <p className="admin-eyebrow">INDEX LEGIONUM</p>
                <h2 id="admin-register-title">Daftar pendaftar</h2>
              </div>
              <span>{filteredRegistrations.length} hasil</span>
            </div>

            <div className="admin-filters">
              <label>
                Pencarian
                <input
                  type="search"
                  placeholder="Nomor, tim, institusi, atau kompetisi"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label>
                Filter status
                <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                  <option value="ALL">Semua status</option>
                  {registrationStates.map((item) => (
                    <option key={item} value={item}>Status: {statusLabels[item]}</option>
                  ))}
                </select>
              </label>
            </div>

            {registrations.length === 0 ? (
              <div className="admin-empty">
                <h3>Belum ada pendaftaran.</h3>
                <p>Pendaftaran baru akan tampil di sini.</p>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <p className="admin-empty">Tidak ada pendaftaran yang cocok dengan filter.</p>
            ) : (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr><th>Tim</th><th>Kompetisi</th><th>Status</th><th>Diperbarui</th><th><span className="admin-sr-only">Aksi</span></th></tr>
                  </thead>
                  <tbody>
                    {filteredRegistrations.map((registration) => (
                      <tr key={registration.id}>
                        <td>
                          <strong>{registration.teamName || 'Nama tim belum tersedia'}</strong>
                          <span>{registration.registrationNumber || 'Tanpa nomor'} · {registration.institution || 'Institusi belum tersedia'}</span>
                        </td>
                        <td>{registration.competition?.name ?? registration.competitionId ?? '—'}</td>
                        <td>
                          <span className={`portal-status portal-status--${statusBadgeStates[registration.status]}`}>
                            {statusLabels[registration.status]}
                          </span>
                        </td>
                        <td>{formatDate(registration.updatedAt)}</td>
                        <td>
                          <Link
                            aria-label={`Tinjau ${registration.teamName || registration.registrationNumber}`}
                            to={`/admin/pendaftaran/${encodeURIComponent(registration.id)}`}
                          >
                            Tinjau →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </AdminShell>
  );
}
