import { useEffect, useState } from 'react';

import { ConfirmationDialog } from '../../components/feedback/ConfirmationDialog';
import { useToast } from '../../components/feedback/ToastProvider';
import { AdminShell } from '../../components/portal/AdminShell';
import {
  registrationApi,
  type AdminParticipantRecord,
  type RegistrationApi,
} from '../../features/registration/api';

interface AdminParticipantsPageProps {
  api?: RegistrationApi;
}

const PAGE_SIZE = 25;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

export default function AdminParticipantsPage({ api = registrationApi }: AdminParticipantsPageProps) {
  const { showToast } = useToast();
  const [participants, setParticipants] = useState<AdminParticipantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AdminParticipantRecord | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

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
    void api.admin.listParticipants({
      query: serverQuery || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((records) => { if (active) setParticipants(Array.isArray(records) ? records : []); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, page, requestVersion, serverQuery]);

  const deleteParticipant = async () => {
    if (!deleteTarget || deleteTarget.deletionBlocked || confirmation !== deleteTarget.email || deleting) return;
    setDeleting(true);
    try {
      await api.admin.deleteParticipant(deleteTarget.id);
      setParticipants((current) => current.filter(({ id }) => id !== deleteTarget.id));
      setDeleteTarget(null);
      setConfirmation('');
      showToast('Akun peserta berhasil dihapus.', 'success');
    } catch (error) {
      showToast(error instanceof Error && error.message.trim()
        ? error.message
        : 'Akun peserta gagal dihapus. Data tetap tersimpan.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminShell>
      <main className="admin-main">
        <header className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">SUPER ADMIN</p>
            <h1>Akun peserta</h1>
            <p className="admin-page-description">Kelola akun peserta. Akun dengan aktivitas pendaftaran tidak dapat dihapus.</p>
          </div>
        </header>
        {loading && <section className="admin-register admin-empty" role="status"><h2>Memuat akun peserta…</h2></section>}
        {!loading && loadError && (
          <section className="admin-register admin-empty" role="alert">
            <h2>Akun peserta gagal dimuat.</h2>
            <button className="admin-action" type="button" onClick={() => setRequestVersion((value) => value + 1)}>Coba lagi</button>
          </section>
        )}
        {!loading && !loadError && (
          <section className="admin-register" aria-labelledby="participant-list-title">
            <div className="admin-register__heading"><div><p className="admin-eyebrow">AKUN</p><h2 id="participant-list-title">Daftar peserta</h2></div><span>Halaman {page} · {participants.length} hasil</span></div>
            <div className="admin-filters">
              <label>Pencarian<input type="search" placeholder="Nama atau email" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <button className="admin-filter-reset" type="button" disabled={!query} onClick={() => { setQuery(''); setServerQuery(''); setPage(1); }}>Reset filter</button>
            </div>
            {participants.length === 0 ? <div className="admin-empty"><p>Tidak ada akun peserta yang cocok.</p></div> : (
              <div className="admin-table-wrap">
                <table>
                  <thead><tr><th>Peserta</th><th>Status akun</th><th>Aktivitas</th><th>Dibuat</th><th><span className="admin-sr-only">Aksi</span></th></tr></thead>
                  <tbody>{participants.map((participant) => (
                    <tr key={participant.id}>
                      <td><strong>{participant.displayName}</strong><span>{participant.email}</span></td>
                      <td><strong>{participant.active ? 'Aktif' : 'Nonaktif'}</strong><span>{participant.emailVerified ? 'Email terverifikasi' : 'Email belum terverifikasi'} · {participant.sessionCount} sesi</span></td>
                      <td>{participant.registration ? <><strong>{participant.registration.teamName || 'Tim tanpa nama'}</strong><span>{participant.registration.registrationNumber} · {participant.registration.status}</span><span>Pembayaran: {participant.registration.paymentStatus ?? 'belum ada'} · Tiket: {participant.registration.ticketStatus ?? 'belum ada'}</span></> : <span>Belum ada pendaftaran</span>}</td>
                      <td>{formatDate(participant.createdAt)}</td>
                      <td>{participant.deletionBlocked ? <span>Terlindungi oleh aktivitas</span> : <button className="admin-delete-link" type="button" aria-label={`Hapus akun ${participant.displayName}`} onClick={() => { setDeleteTarget(participant); setConfirmation(''); }}>Hapus</button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <nav className="admin-pagination" aria-label="Halaman akun peserta">
              <button className="admin-action" type="button" aria-label="Halaman sebelumnya" disabled={page === 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</button>
              <span>Halaman {page}</span>
              <button className="admin-action" type="button" aria-label="Halaman berikutnya" disabled={participants.length < PAGE_SIZE || loading} onClick={() => setPage((value) => value + 1)}>Berikutnya</button>
            </nav>
          </section>
        )}
      </main>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Hapus akun peserta permanen?"
        description={<p>Akun tanpa aktivitas beserta sesi dan token autentikasinya akan dihapus. Tindakan ini tidak dapat dibatalkan.</p>}
        confirmationLabel={deleteTarget?.email ?? ''}
        confirmationValue={confirmation}
        pending={deleting}
        onConfirmationChange={setConfirmation}
        onCancel={() => { if (!deleting) { setDeleteTarget(null); setConfirmation(''); } }}
        onConfirm={() => void deleteParticipant()}
      />
    </AdminShell>
  );
}
