import { useEffect, useState } from 'react';

import { AdminShell } from '../../components/portal/AdminShell';
import {
  registrationApi,
  type PaidTeamRecord,
  type RegistrationApi,
} from '../../features/registration/api';

interface AdminPaidTeamsPageProps {
  api?: RegistrationApi;
}

const PAGE_SIZE = 50;

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeZone: 'Asia/Jakarta',
      }).format(date);
}

export default function AdminPaidTeamsPage({ api = registrationApi }: AdminPaidTeamsPageProps) {
  const [teams, setTeams] = useState<PaidTeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setServerQuery(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void api.admin.listPaidTeams({
      query: serverQuery || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (!active) return;
        setTeams(Array.isArray(result.items) ? result.items : []);
        setHasNextPage(result.hasNextPage === true);
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, page, requestVersion, serverQuery]);

  return (
    <AdminShell>
      <main className="admin-main">
        <header className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">AKSES BACA SAJA</p>
            <h1>Tim lunas</h1>
            <p className="admin-page-description">
              Daftar tim dengan pembayaran yang sudah diverifikasi oleh divisi keuangan.
            </p>
          </div>
        </header>

        {loading && <section className="admin-register admin-empty" role="status"><h2>Memuat daftar tim lunas…</h2></section>}
        {!loading && loadError && (
          <section className="admin-register admin-empty" role="alert">
            <h2>Daftar tim lunas gagal dimuat.</h2>
            <button className="admin-action" type="button" onClick={() => setRequestVersion((value) => value + 1)}>Coba lagi</button>
          </section>
        )}
        {!loading && !loadError && (
          <section className="admin-register" aria-labelledby="paid-team-list-title">
            <div className="admin-register__heading">
              <div><p className="admin-eyebrow">PEMBAYARAN TERVERIFIKASI</p><h2 id="paid-team-list-title">Daftar tim</h2></div>
              <span>Halaman {page} · {teams.length} hasil</span>
            </div>
            <div className="admin-filters">
              <label htmlFor="paid-team-search">Cari tim
                <input
                  id="paid-team-search"
                  type="search"
                  placeholder="Nama tim, instansi, nomor, atau lomba"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button className="admin-filter-reset" type="button" disabled={!query} onClick={() => { setQuery(''); setServerQuery(''); setPage(1); }}>Reset filter</button>
            </div>
            {teams.length === 0 ? (
              <div className="admin-empty"><p>Belum ada tim dengan pembayaran terverifikasi.</p></div>
            ) : (
              <div className="admin-table-wrap">
                <table>
                  <thead><tr><th>Tim</th><th>Instansi</th><th>Kompetisi</th><th>Terbayar</th></tr></thead>
                  <tbody>{teams.map((team) => (
                    <tr key={team.registrationNumber}>
                      <td><strong>{team.teamName}</strong><span>{team.registrationNumber}</span></td>
                      <td>{team.institution}</td>
                      <td><strong>{team.competition.name}</strong><span>{team.competition.level} · {team.competition.discipline}</span></td>
                      <td>{formatDate(team.verifiedAt)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <nav className="admin-pagination" aria-label="Halaman daftar tim lunas">
              <button className="admin-action" type="button" disabled={page === 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</button>
              <span>Halaman {page}</span>
              <button className="admin-action" type="button" disabled={!hasNextPage || loading} onClick={() => setPage((value) => value + 1)}>Berikutnya</button>
            </nav>
          </section>
        )}
      </main>
    </AdminShell>
  );
}