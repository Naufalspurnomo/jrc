import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { AdminShell } from '../../components/portal/AdminShell';
import {
  registrationApi,
  type PaidTeamDetailRecord,
  type RegistrationApi,
} from '../../features/registration/api';
import { apiUrl } from '../../features/registration/apiOrigin';

interface AdminPaidTeamDetailPageProps {
  api?: RegistrationApi;
}

const memberRoleLabels = {
  LEADER: 'Ketua',
  MEMBER: 'Anggota',
  SUPERVISOR: 'Pembina',
} as const;

function formatDate(value: string | null): string {
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

function formatAmount(amount: number, currency: string): string {
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
}

export default function AdminPaidTeamDetailPage({ api = registrationApi }: AdminPaidTeamDetailPageProps) {
  const { registrationId } = useParams<{ registrationId: string }>();
  const [team, setTeam] = useState<PaidTeamDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (!registrationId) {
      setLoading(false);
      setLoadError(true);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setLoadError(false);
    void api.admin.getPaidTeam(registrationId)
      .then((record) => { if (active) setTeam(record); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, registrationId, requestVersion]);

  return (
    <AdminShell>
      <main className="admin-main admin-detail admin-paid-team-detail">
        <Link className="admin-back" to="/admin/tim-lunas">← Kembali ke daftar tim lunas</Link>

        {loading && (
          <section className="admin-empty" role="status"><h1>Memuat detail tim…</h1></section>
        )}
        {!loading && loadError && (
          <section className="admin-empty" role="alert">
            <h1>Detail tim gagal dimuat.</h1>
            <p>Periksa koneksi atau akses tim, lalu coba lagi.</p>
            <button className="admin-action" type="button" onClick={() => setRequestVersion((value) => value + 1)}>Coba lagi</button>
          </section>
        )}

        {!loading && !loadError && team && (
          <>
            <header className="admin-detail__header">
              <div>
                <p className="admin-eyebrow">{team.registrationNumber}</p>
                <h1>{team.teamName}</h1>
                <p>{team.institution}</p>
              </div>
              <span className="admin-readonly-badge">BACA SAJA</span>
            </header>

            <div className="admin-detail__content">
              <section className="admin-detail-section" aria-labelledby="paid-team-identity-title">
                <div className="admin-detail-section__heading"><h2 id="paid-team-identity-title">Data tim</h2></div>
                <dl className="admin-detail-grid">
                  <div><dt>Nama tim</dt><dd>{team.teamName}</dd></div>
                  <div><dt>Instansi</dt><dd>{team.institution}</dd></div>
                  <div><dt>Kontak tim</dt><dd>{team.phone || '—'}</dd></div>
                  <div><dt>Nama pendaftar</dt><dd>{team.owner.displayName}</dd></div>
                  <div><dt>Email pendaftar</dt><dd>{team.owner.email}</dd></div>
                  <div><dt>Dikirim</dt><dd>{formatDate(team.submittedAt)}</dd></div>
                </dl>
              </section>

              <section className="admin-detail-section" aria-labelledby="paid-team-competition-title">
                <div className="admin-detail-section__heading"><h2 id="paid-team-competition-title">Kompetisi</h2></div>
                <dl className="admin-detail-grid">
                  <div><dt>Nama lomba</dt><dd>{team.competition.name}</dd></div>
                  <div><dt>Tingkat</dt><dd>{team.competition.level}</dd></div>
                  <div><dt>Disiplin</dt><dd>{team.competition.discipline}</dd></div>
                  <div><dt>Acara</dt><dd>{team.competition.eventName}</dd></div>
                </dl>
              </section>

              <section className="admin-detail-section" aria-labelledby="paid-team-members-title">
                <div className="admin-detail-section__heading"><h2 id="paid-team-members-title">Anggota tim</h2></div>
                {team.members.length > 0 ? (
                  <div className="admin-member-list admin-member-list--photos">
                    {team.members.map((member) => (
                      <article key={member.id} aria-label={`Anggota ${member.name}`}>
                        {member.photo ? (
                          <img
                            className="admin-member-photo"
                            src={apiUrl(member.photo.viewUrl)}
                            alt={`Foto ${member.name}`}
                          />
                        ) : (
                          <div className="admin-member-photo admin-member-photo--empty">Foto belum tersedia</div>
                        )}
                        <span>{memberRoleLabels[member.role ?? 'MEMBER']}</span>
                        <strong>{member.name}</strong>
                        <small>{member.studentId || 'Nomor identitas belum tersedia'}</small>
                        {member.email && <a href={`mailto:${member.email}`}>{member.email}</a>}
                        {member.phone && <small>{member.phone}</small>}
                        {member.photo && (
                          <div className="admin-file-actions">
                            <a href={apiUrl(member.photo.viewUrl)} target="_blank" rel="noreferrer">Buka foto</a>
                            <a href={apiUrl(member.photo.downloadUrl)} aria-label={`Unduh foto ${member.name}`}>Unduh foto</a>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                ) : <p className="admin-muted">Belum ada data anggota.</p>}
              </section>

              <section className="admin-detail-section" aria-labelledby="paid-team-payment-title" aria-label="Pembayaran">
                <div className="admin-detail-section__heading"><h2 id="paid-team-payment-title">Pembayaran</h2></div>
                <dl className="admin-detail-grid">
                  <div><dt>Invoice</dt><dd>{team.payment.invoiceNumber}</dd></div>
                  <div><dt>Jumlah</dt><dd>{formatAmount(team.payment.amount, team.payment.currency)}</dd></div>
                  <div><dt>Status</dt><dd>Lunas</dd></div>
                  <div><dt>Diverifikasi</dt><dd>{formatDate(team.payment.verifiedAt)}</dd></div>
                </dl>
                {team.payment.proof ? (
                  <div className="admin-proof admin-proof--readonly">
                    <div>
                      <strong>{team.payment.proof.originalName}</strong>
                      <small>{team.payment.proof.mimeType} · {formatFileSize(team.payment.proof.size)}</small>
                    </div>
                    <div className="admin-file-actions">
                      <a href={apiUrl(team.payment.proof.viewUrl)} target="_blank" rel="noreferrer">Buka bukti pembayaran</a>
                      <a href={apiUrl(team.payment.proof.downloadUrl)}>Unduh bukti pembayaran</a>
                    </div>
                  </div>
                ) : <p className="admin-muted">Bukti pembayaran tidak tersedia.</p>}
              </section>
            </div>
          </>
        )}
      </main>
    </AdminShell>
  );
}
