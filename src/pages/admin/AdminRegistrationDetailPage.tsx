import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { AdminShell } from '../../components/portal/AdminShell';
import { StatusBadge } from '../../components/portal/StatusBadge';
import { useAuth } from '../../features/auth';
import {
  registrationApi,
  type AuthUser,
  type InvoiceRecord,
  type RegistrationApi,
  type RegistrationRecord,
  type RegistrationState,
} from '../../features/registration/api';

interface AdminRegistrationDetailPageProps {
  api?: RegistrationApi;
}

type StatusBadgeState = ComponentProps<typeof StatusBadge>['status'];
type AdminRegistrationRecord = Omit<RegistrationRecord, 'invoice'> & {
  owner?: Pick<AuthUser, 'id' | 'displayName' | 'email'> | null;
  invoice?: Partial<InvoiceRecord> | null;
};

const allowedRoles = new Set(['SUPER_ADMIN', 'REGISTRATION_REVIEWER', 'SUPPORT']);

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

const paymentStatusLabels: Record<NonNullable<RegistrationRecord['paymentStatus']>, string> = {
  NOT_CREATED: 'Belum dibuat',
  UNPAID: 'Belum dibayar',
  PENDING_VERIFICATION: 'Menunggu verifikasi',
  PAID: 'Lunas',
  REJECTED: 'Bukti ditolak',
  EXPIRED: 'Kedaluwarsa',
  REFUNDED: 'Dikembalikan',
};

const ticketStatusLabels: Record<NonNullable<RegistrationRecord['ticketStatus']>, string> = {
  INACTIVE: 'Belum aktif',
  ACTIVE: 'Aktif',
  CHECKED_IN: 'Sudah check-in',
  REVOKED: 'Dicabut',
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(date);
}

function formatAmount(amount: number | undefined, currency: string | undefined): string {
  if (typeof amount !== 'number' || !currency) return '—';
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('id-ID')}`;
  }
}

export default function AdminRegistrationDetailPage({ api = registrationApi }: AdminRegistrationDetailPageProps) {
  const { registrationId } = useParams<{ registrationId: string }>();
  const { loading: authLoading, logout, user } = useAuth();
  const [registration, setRegistration] = useState<AdminRegistrationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [reviewReason, setReviewReason] = useState('');
  const [mutationLoading, setMutationLoading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const loadRegistration = useCallback(async () => {
    if (!registrationId) throw new Error('Registration ID is missing');
    const record = await api.admin.getRegistration(registrationId);
    return record as AdminRegistrationRecord;
  }, [api, registrationId]);

  useEffect(() => {
    if (authLoading || !user || !allowedRoles.has(user.role)) return undefined;

    let active = true;
    setLoading(true);
    setLoadError(false);

    void loadRegistration()
      .then((record) => {
        if (active) setRegistration(record);
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
  }, [authLoading, loadRegistration, requestVersion, user]);

  const signOut = () => {
    void logout().catch(() => undefined);
  };

  const updateReviewStatus = async (status: RegistrationState) => {
    if (!registrationId) {
      setMutationError('ID pendaftaran tidak tersedia.');
      return;
    }

    const requiresReason = status === 'REVISION_REQUESTED' || status === 'REJECTED';
    const reason = reviewReason.trim();
    if (requiresReason && !reason) {
      setMutationError('Alasan wajib diisi untuk meminta revisi atau menolak pendaftaran.');
      return;
    }

    setMutationLoading(true);
    setMutationError(null);

    try {
      const input = requiresReason ? { status, reason } : { status };
      await api.admin.reviewRegistration(registrationId, input);
      const refreshedRegistration = await loadRegistration();
      setRegistration(refreshedRegistration);
      setReviewReason('');
    } catch {
      setMutationError('Keputusan gagal disimpan. Silakan coba lagi.');
    } finally {
      setMutationLoading(false);
    }
  };

  if (!authLoading && (!user || !allowedRoles.has(user.role))) {
    return <Navigate replace to="/admin/masuk" />;
  }

  const members = Array.isArray(registration?.members) ? registration.members : [];
  const documents = Array.isArray(registration?.documents) ? registration.documents : [];
  const ticketStatus = registration?.ticket?.status ?? registration?.ticketStatus;
  const paymentStatus = registration?.invoice?.paymentStatus ?? registration?.paymentStatus;

  return (
    <AdminShell onSignOut={signOut}>
      <main className="admin-main admin-detail">
        <Link className="admin-back" to="/admin">← Kembali ke daftar pendaftaran</Link>

        {(authLoading || loading) && (
          <section className="admin-empty" role="status">
            <h1>Memuat detail pendaftaran…</h1>
          </section>
        )}

        {!authLoading && !loading && loadError && (
          <section className="admin-empty" role="alert">
            <h1>Detail pendaftaran gagal dimuat.</h1>
            <p>Periksa koneksi, lalu coba lagi.</p>
            <button className="admin-action" type="button" onClick={() => setRequestVersion((value) => value + 1)}>
              Coba lagi
            </button>
          </section>
        )}

        {!authLoading && !loading && !loadError && registration && (
          <>
            <header className="admin-detail__header">
              <div>
                <p className="admin-eyebrow">{registration.registrationNumber || registration.id}</p>
                <h1>{registration.teamName || 'Nama tim belum tersedia'}</h1>
                <p>{registration.institution || 'Institusi belum tersedia'}</p>
              </div>
              <StatusBadge status={statusBadgeStates[registration.status]} />
            </header>

            <div className="admin-detail__layout">
              <div className="admin-detail__content">
                <section className="admin-detail-section" aria-labelledby="admin-owner-title">
                  <div className="admin-detail-section__heading"><span>I</span><h2 id="admin-owner-title">Pemilik pendaftaran</h2></div>
                  <dl className="admin-detail-grid">
                    <div><dt>Nama</dt><dd>{registration.owner?.displayName || '—'}</dd></div>
                    <div><dt>Email</dt><dd>{registration.owner?.email || '—'}</dd></div>
                    <div><dt>Telepon tim</dt><dd>{registration.phone || '—'}</dd></div>
                  </dl>
                </section>

                <section className="admin-detail-section" aria-labelledby="admin-team-title">
                  <div className="admin-detail-section__heading"><span>II</span><h2 id="admin-team-title">Tim dan kompetisi</h2></div>
                  <dl className="admin-detail-grid">
                    <div><dt>Nama tim</dt><dd>{registration.teamName || '—'}</dd></div>
                    <div><dt>Institusi</dt><dd>{registration.institution || '—'}</dd></div>
                    <div><dt>Kompetisi</dt><dd>{registration.competition?.name || registration.competitionId || '—'}</dd></div>
                    <div><dt>Acara</dt><dd>{registration.competition?.eventName || '—'}</dd></div>
                    <div><dt>Dikirim</dt><dd>{formatDate(registration.submittedAt)}</dd></div>
                    <div><dt>Diperbarui</dt><dd>{formatDate(registration.updatedAt)}</dd></div>
                  </dl>
                </section>

                <section className="admin-detail-section" aria-labelledby="admin-members-title">
                  <div className="admin-detail-section__heading"><span>III</span><h2 id="admin-members-title">Anggota</h2></div>
                  {members.length > 0 ? (
                    <div className="admin-member-list">
                      {members.map((member) => (
                        <article key={member.id}>
                          <span>{member.role === 'LEADER' ? 'Ketua' : 'Anggota'}</span>
                          <strong>{member.name || 'Nama belum tersedia'}</strong>
                          {member.studentId && <small>{member.studentId}</small>}
                          {member.email && <a href={`mailto:${member.email}`}>{member.email}</a>}
                          {member.phone && <small>{member.phone}</small>}
                        </article>
                      ))}
                    </div>
                  ) : <p className="admin-muted">Belum ada anggota.</p>}
                </section>

                <section className="admin-detail-section" aria-labelledby="admin-documents-title">
                  <div className="admin-detail-section__heading"><span>IV</span><h2 id="admin-documents-title">Dokumen</h2></div>
                  {documents.length > 0 ? documents.map((document) => (
                    <article className="admin-document" key={document.id}>
                      <span>DOC</span>
                      <div>
                        <strong>{document.originalName || 'Dokumen tanpa nama'}</strong>
                        <small>{document.category || 'Kategori tidak tersedia'} · {Math.max(1, Math.round(document.size / 1024))} KB</small>
                      </div>
                      {document.downloadUrl && (
                        <a href={document.downloadUrl} aria-label={`Unduh ${document.originalName}`}>
                          Unduh
                        </a>
                      )}
                    </article>
                  )) : <p className="admin-muted">Belum ada dokumen.</p>}
                </section>

                <section className="admin-detail-section" aria-labelledby="admin-billing-title">
                  <div className="admin-detail-section__heading"><span>V</span><h2 id="admin-billing-title">Invoice dan tiket</h2></div>
                  <dl className="admin-detail-grid">
                    <div><dt>Invoice</dt><dd>{registration.invoice?.invoiceNumber || 'Belum dibuat'}</dd></div>
                    <div><dt>Jumlah</dt><dd>{formatAmount(registration.invoice?.amount, registration.invoice?.currency)}</dd></div>
                    <div><dt>Status pembayaran</dt><dd>{paymentStatus ? paymentStatusLabels[paymentStatus] : 'Belum dibuat'}</dd></div>
                    <div><dt>Status tiket</dt><dd>{ticketStatus ? ticketStatusLabels[ticketStatus] : 'Belum diterbitkan'}</dd></div>
                  </dl>
                </section>
              </div>

              <aside className="admin-review-panel" aria-labelledby="admin-review-title">
                <p className="admin-eyebrow">REVIEW ADMINISTRASI</p>
                <h2 id="admin-review-title">Keputusan pendaftaran</h2>
                <p>Status saat ini: <strong>{statusLabels[registration.status]}</strong></p>
                {registration.reviewReason && <p>Alasan terakhir: {registration.reviewReason}</p>}

                {registration.status === 'SUBMITTED' && (
                  <button
                    className="admin-action"
                    disabled={mutationLoading}
                    type="button"
                    onClick={() => void updateReviewStatus('UNDER_REVIEW')}
                  >
                    Mulai review
                  </button>
                )}

                {registration.status === 'UNDER_REVIEW' && (
                  <>
                    <label htmlFor="admin-review-reason">Alasan keputusan</label>
                    <textarea
                      id="admin-review-reason"
                      disabled={mutationLoading}
                      value={reviewReason}
                      onChange={(event) => setReviewReason(event.target.value)}
                      placeholder="Tulis alasan untuk revisi atau penolakan"
                    />
                    <div>
                      <button
                        className="admin-action"
                        disabled={mutationLoading}
                        type="button"
                        onClick={() => void updateReviewStatus('APPROVED')}
                      >
                        Setujui
                      </button>
                      <button
                        className="admin-action"
                        disabled={mutationLoading}
                        type="button"
                        onClick={() => void updateReviewStatus('REVISION_REQUESTED')}
                      >
                        Minta revisi
                      </button>
                      <button
                        className="admin-action"
                        disabled={mutationLoading}
                        type="button"
                        onClick={() => void updateReviewStatus('REJECTED')}
                      >
                        Tolak
                      </button>
                    </div>
                  </>
                )}

                {mutationLoading && <p role="status">Menyimpan keputusan…</p>}
                {mutationError && <p role="alert">{mutationError}</p>}
              </aside>
            </div>
          </>
        )}
      </main>
    </AdminShell>
  );
}