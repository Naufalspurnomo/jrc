import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AdminShell } from '../../components/portal/AdminShell';
import { StatusBadge, registrationStatusLabel } from '../../components/portal/StatusBadge';
import {
  PORTAL_COMPETITIONS,
  portalRepository,
  type PortalRepository,
  type Registration,
  type RegistrationStatus,
} from '../../data/portal';

interface AdminRegistrationDetailPageProps {
  repository?: PortalRepository;
  registrationId?: string;
}

export default function AdminRegistrationDetailPage({
  repository = portalRepository,
  registrationId,
}: AdminRegistrationDetailPageProps) {
  const params = useParams();
  const session = repository.getSession();
  const [registration, setRegistration] = useState<Registration | null>(() => (
    repository.getRegistration(registrationId ?? params.registrationId ?? params.id ?? '')
  ));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!session || session.role !== 'admin') return <Navigate replace to="/admin" />;
  if (!registration) {
    return (
      <AdminShell>
        <main className="admin-main admin-empty"><h1>Pendaftaran tidak ditemukan.</h1><Link to="/admin">Kembali</Link></main>
      </AdminShell>
    );
  }

  const applyReview = (status: RegistrationStatus) => {
    try {
      const reviewed = repository.reviewRegistration(registration.id, status, note, session.name);
      setRegistration(reviewed);
      setNote('');
      setError('');
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Review gagal disimpan.');
    }
  };
  const competition = PORTAL_COMPETITIONS.find((item) => item.id === registration.competitionId);

  return (
    <AdminShell>
      <main className="admin-main admin-detail">
        <Link className="admin-back" to="/admin">← Kembali ke index legionum</Link>
        <header className="admin-detail__header">
          <div>
            <p className="admin-eyebrow">{registration.id.toUpperCase()} · {competition?.level ?? 'UMUM'}</p>
            <h1>{registration.teamName}</h1>
            <p>{registration.institution}</p>
          </div>
          <StatusBadge status={registration.status} />
        </header>

        <div className="admin-detail__layout">
          <div className="admin-detail__content">
            <section className="admin-detail-section" aria-labelledby="admin-team-title">
              <div className="admin-detail-section__heading"><span>I</span><h2 id="admin-team-title">Identitas legion</h2></div>
              <dl className="admin-detail-grid">
                <div><dt>Nama tim</dt><dd>{registration.teamName}</dd></div>
                <div><dt>Institusi</dt><dd>{registration.institution}</dd></div>
                <div><dt>Arena</dt><dd>{competition?.name ?? registration.competitionId}</dd></div>
                <div><dt>Terakhir diperbarui</dt><dd>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(registration.updatedAt))}</dd></div>
              </dl>
            </section>

            <section className="admin-detail-section" aria-labelledby="admin-members-title">
              <div className="admin-detail-section__heading"><span>II</span><h2 id="admin-members-title">Anggota</h2></div>
              {registration.members.length > 0 ? (
                <div className="admin-member-list">
                  {registration.members.map((member) => (
                    <article key={member.id}>
                      <span>{member.role === 'leader' ? 'Ketua' : 'Anggota'}</span>
                      <strong>{member.name}</strong>
                      <a href={`mailto:${member.email}`}>{member.email}</a>
                      <small>{member.phone}</small>
                    </article>
                  ))}
                </div>
              ) : <p className="admin-muted">Belum ada data anggota pada fixture demo ini.</p>}
            </section>

            <section className="admin-detail-section" aria-labelledby="admin-documents-title">
              <div className="admin-detail-section__heading"><span>III</span><h2 id="admin-documents-title">Dokumen</h2></div>
              {registration.documents.length > 0 ? registration.documents.map((document) => (
                <article className="admin-document" key={`${document.name}-${document.lastModified}`}>
                  <span>DOC</span><div><strong>{document.name}</strong><small>{document.type || 'Tipe tidak diketahui'} · {Math.max(1, Math.round(document.size / 1024))} KB</small></div>
                  <em>Metadata lokal</em>
                </article>
              )) : <p className="admin-muted">Belum ada metadata dokumen pada fixture demo ini.</p>}
            </section>

            <section className="admin-detail-section" aria-labelledby="admin-history-title">
              <div className="admin-detail-section__heading"><span>IV</span><h2 id="admin-history-title">Jejak review</h2></div>
              {registration.reviews.length > 0 ? (
                <ol className="admin-review-history">
                  {registration.reviews.toReversed().map((review) => (
                    <li key={review.id}>
                      <span aria-hidden="true" />
                      <div><strong>{registrationStatusLabel(review.status)}</strong><p>{review.note}</p><small>{review.author} · {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(review.createdAt))}</small></div>
                    </li>
                  ))}
                </ol>
              ) : <p className="admin-muted">Belum ada catatan panitia.</p>}
            </section>
          </div>

          <aside className="admin-review-panel" aria-labelledby="admin-review-title">
            <p className="admin-eyebrow">SENTENTIA</p>
            <h2 id="admin-review-title">Putusan administrasi</h2>
            <p>Status saat ini: <strong>{registrationStatusLabel(registration.status)}</strong></p>
            {['submitted', 'under_review'].includes(registration.status) ? (
              <>
                <label>Catatan panitia<textarea rows={6} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Tuliskan alasan yang jelas untuk peserta…" /></label>
                {error && <p className="admin-error" role="alert">{error}</p>}
                {registration.status === 'submitted' && (
                  <button className="admin-action admin-action--primary" type="button" onClick={() => applyReview('under_review')}>Mulai review</button>
                )}
                {registration.status === 'under_review' && (
                  <div className="admin-review-actions">
                    <button className="admin-action admin-action--primary" type="button" onClick={() => applyReview('verified')}>Verifikasi</button>
                    <button className="admin-action" type="button" onClick={() => applyReview('revision_requested')}>Minta revisi</button>
                    <button className="admin-action admin-action--danger" type="button" onClick={() => applyReview('rejected')}>Tolak</button>
                  </div>
                )}
              </>
            ) : (
              <p className="admin-final-state">Status ini telah final pada prototype. Jejak keputusan tersimpan di perangkat lokal.</p>
            )}
          </aside>
        </div>
      </main>
    </AdminShell>
  );
}
