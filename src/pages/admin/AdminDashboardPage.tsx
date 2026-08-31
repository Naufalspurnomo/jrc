import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminShell } from '../../components/portal/AdminShell';
import { StatusBadge } from '../../components/portal/StatusBadge';
import {
  PORTAL_COMPETITIONS,
  REGISTRATION_STATUSES,
  portalRepository,
  type PortalRepository,
  type RegistrationFilters,
  type RegistrationStatus,
} from '../../features/registration';

interface AdminDashboardPageProps {
  repository?: PortalRepository;
}

const downloadCsv = (csv: string) => {
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `jrc-xiv-pendaftaran-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function AdminDashboardPage({ repository = portalRepository }: AdminDashboardPageProps) {
  const [, setSessionVersion] = useState(0);
  const [status, setStatus] = useState<RegistrationStatus | 'all'>('all');
  const [competitionId, setCompetitionId] = useState('');
  const [query, setQuery] = useState('');
  const session = repository.getSession();

  const filters: RegistrationFilters = { status, competitionId: competitionId || undefined, query };
  const registrations = repository.listRegistrations(filters);
  const all = repository.listRegistrations();

  if (!session || session.role !== 'admin') {
    return (
      <main className="admin-auth">
        <section>
          <p className="admin-eyebrow">OFFICIUM · DEMO LOKAL</p>
          <h1>Meja panitia menanti.</h1>
          <p>Tinjau pendaftaran, berikan catatan, dan gerakkan status tim melalui simulasi lokal.</p>
          <button type="button" onClick={() => {
            repository.startSession({ role: 'admin', name: 'Panitia JRC' });
            setSessionVersion((value) => value + 1);
          }}>Masuk sebagai admin</button>
        </section>
      </main>
    );
  }

  const signOut = () => {
    repository.endSession();
    setSessionVersion((value) => value + 1);
  };

  return (
    <AdminShell onSignOut={signOut}>
      <main className="admin-main">
        <header className="admin-page-heading">
          <div><p className="admin-eyebrow">TABULARIUM · XIV</p><h1>Meja komando pendaftaran</h1></div>
          <button className="admin-export" type="button" onClick={() => downloadCsv(repository.exportRegistrationsCsv(filters))}>
            Ekspor CSV
          </button>
        </header>

        <section className="admin-metrics" aria-label="Ringkasan status">
          <article><span>Total legion</span><strong>{all.length}</strong><small>seluruh pendaftaran</small></article>
          <article><span>Menanti telaah</span><strong>{all.filter((item) => item.status === 'submitted').length}</strong><small>siap diperiksa</small></article>
          <article><span>Dalam review</span><strong>{all.filter((item) => item.status === 'under_review').length}</strong><small>di meja panitia</small></article>
          <article><span>Terverifikasi</span><strong>{all.filter((item) => item.status === 'verified').length}</strong><small>lolos administrasi</small></article>
        </section>

        <section className="admin-register" aria-labelledby="admin-register-title">
          <div className="admin-register__heading">
            <div><p className="admin-eyebrow">INDEX LEGIONUM</p><h2 id="admin-register-title">Daftar pendaftar</h2></div>
            <span>{registrations.length} hasil</span>
          </div>
          <div className="admin-filters">
            <label>Pencarian<input type="search" placeholder="Tim atau institusi" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <label>Filter status
              <select value={status} onChange={(event) => setStatus(event.target.value as RegistrationStatus | 'all')}>
                <option value="all">Semua status</option>
                {REGISTRATION_STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label>Filter arena
              <select value={competitionId} onChange={(event) => setCompetitionId(event.target.value)}>
                <option value="">Semua arena</option>
                {PORTAL_COMPETITIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>

          <div className="admin-table-wrap">
            <table>
              <thead><tr><th>Legion</th><th>Arena</th><th>Status</th><th>Diperbarui</th><th><span className="admin-sr-only">Aksi</span></th></tr></thead>
              <tbody>
                {registrations.map((registration) => (
                  <tr key={registration.id}>
                    <td><strong>{registration.teamName}</strong><span>{registration.institution}</span></td>
                    <td>{PORTAL_COMPETITIONS.find((item) => item.id === registration.competitionId)?.name ?? registration.competitionId}</td>
                    <td><StatusBadge status={registration.status} /></td>
                    <td>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(registration.updatedAt))}</td>
                    <td><Link aria-label={`Tinjau ${registration.teamName}`} to={`/admin/pendaftaran/${registration.id}`}>Tinjau →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {registrations.length === 0 && <p className="admin-empty">Tidak ada legion yang cocok dengan filter.</p>}
        </section>
      </main>
    </AdminShell>
  );
}
