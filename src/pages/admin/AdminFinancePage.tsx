import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { AdminShell } from '../../components/portal/AdminShell';
import { PaymentStatusNotice } from '../../components/portal/PaymentStatusNotice';
import { useAuth } from '../../features/auth';
import {
  registrationApi,
  type PaymentReviewInput,
  type PaymentState,
  type RegistrationApi,
} from '../../features/registration/api';

interface AdminFinancePageProps {
  api?: RegistrationApi;
}

interface SafeFinanceInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  paymentStatus: PaymentState;
  deadline: string;
  proof: {
    originalName: string;
    mimeType: string;
    size: number;
  } | null;
  registration: {
    registrationNumber: string;
    teamName: string;
    institution: string;
    owner: {
      displayName: string;
    } | null;
    competition: {
      id: string;
      name: string;
    } | null;
  };
}

interface FinanceAdminApi {
  listFinanceInvoices(): Promise<unknown[]>;
  verifyPayment(invoiceId: string, input: PaymentReviewInput): Promise<unknown>;
}

const allowedRoles = new Set(['SUPER_ADMIN', 'FINANCE']);

function financeAdmin(api: RegistrationApi): FinanceAdminApi {
  return api.admin as unknown as FinanceAdminApi;
}

function allowlistedInvoice(value: unknown): SafeFinanceInvoice | null {
  if (typeof value !== 'object' || value === null) return null;

  const invoice = value as Record<string, unknown>;
  const proof = typeof invoice.proof === 'object' && invoice.proof !== null
    ? invoice.proof as Record<string, unknown>
    : null;
  const registration = typeof invoice.registration === 'object' && invoice.registration !== null
    ? invoice.registration as Record<string, unknown>
    : null;
  const owner = registration && typeof registration.owner === 'object' && registration.owner !== null
    ? registration.owner as Record<string, unknown>
    : null;
  const competition = registration
    && typeof registration.competition === 'object'
    && registration.competition !== null
    ? registration.competition as Record<string, unknown>
    : null;

  if (
    typeof invoice.id !== 'string'
    || typeof invoice.invoiceNumber !== 'string'
    || typeof invoice.amount !== 'number'
    || typeof invoice.currency !== 'string'
    || typeof invoice.paymentStatus !== 'string'
    || typeof invoice.deadline !== 'string'
    || !registration
  ) return null;

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    currency: invoice.currency,
    paymentStatus: invoice.paymentStatus as PaymentState,
    deadline: invoice.deadline,
    proof: proof
      && typeof proof.originalName === 'string'
      && typeof proof.mimeType === 'string'
      && typeof proof.size === 'number'
      ? {
        originalName: proof.originalName,
        mimeType: proof.mimeType,
        size: proof.size,
      }
      : null,
    registration: {
      registrationNumber: typeof registration.registrationNumber === 'string'
        ? registration.registrationNumber
        : '',
      teamName: typeof registration.teamName === 'string' ? registration.teamName : '',
      institution: typeof registration.institution === 'string' ? registration.institution : '',
      owner: owner && typeof owner.displayName === 'string'
        ? { displayName: owner.displayName }
        : null,
      competition: competition
        && typeof competition.id === 'string'
        && typeof competition.name === 'string'
        ? { id: competition.id, name: competition.name }
        : null,
    },
  };
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
}

export default function AdminFinancePage({ api = registrationApi }: AdminFinancePageProps) {
  const { loading: authLoading, logout, user } = useAuth();
  const [invoices, setInvoices] = useState<SafeFinanceInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [decisionErrors, setDecisionErrors] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (authLoading || !user || !allowedRoles.has(user.role)) return undefined;

    let active = true;
    setLoading(true);
    setLoadError(false);

    void financeAdmin(api).listFinanceInvoices()
      .then((records) => {
        if (!active) return;
        setInvoices(
          (Array.isArray(records) ? records : [])
            .map(allowlistedInvoice)
            .filter((record): record is SafeFinanceInvoice => record !== null),
        );
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

  const decide = async (invoiceId: string, status: PaymentReviewInput['status']) => {
    const reason = reasons[invoiceId]?.trim() ?? '';
    if (!reason) {
      setDecisionErrors((current) => ({
        ...current,
        [invoiceId]: 'Alasan atau referensi verifikasi wajib diisi.',
      }));
      return;
    }

    setDecisionErrors((current) => ({ ...current, [invoiceId]: '' }));
    setSavingIds((current) => new Set(current).add(invoiceId));

    try {
      await financeAdmin(api).verifyPayment(invoiceId, { status, reason });
      setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceId));
      setReasons((current) => {
        const next = { ...current };
        delete next[invoiceId];
        return next;
      });
    } catch {
      setDecisionErrors((current) => ({
        ...current,
        [invoiceId]: 'Keputusan pembayaran gagal disimpan. Coba lagi.',
      }));
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(invoiceId);
        return next;
      });
    }
  };

  if (!authLoading && (!user || !allowedRoles.has(user.role))) {
    return <Navigate replace to="/admin/masuk" />;
  }

  return (
    <AdminShell onSignOut={() => void logout().catch(() => undefined)}>
      <main className="admin-main admin-finance">
        <header className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">RATIO · XIV</p>
            <h1>Verifikasi pembayaran</h1>
          </div>
        </header>

        {!authLoading && loading && (
          <section className="admin-register admin-empty" role="status">
            <h2>Memuat antrean pembayaran…</h2>
            <p>Bukti pembayaran sedang disiapkan.</p>
          </section>
        )}

        {!authLoading && !loading && loadError && (
          <section className="admin-register admin-empty" role="alert">
            <h2>Antrean pembayaran gagal dimuat.</h2>
            <p>Periksa koneksi, lalu coba lagi.</p>
            <button
              className="admin-action"
              type="button"
              onClick={() => setRequestVersion((version) => version + 1)}
            >
              Coba lagi
            </button>
          </section>
        )}

        {!authLoading && !loading && !loadError && invoices.length === 0 && (
          <section className="admin-register admin-empty">
            <h2>Tidak ada bukti pembayaran yang menunggu verifikasi.</h2>
          </section>
        )}

        {!authLoading && !loading && !loadError && invoices.length > 0 && (
          <section className="admin-register" aria-labelledby="finance-queue-title">
            <div className="admin-register__heading">
              <div>
                <p className="admin-eyebrow">ANTREAN FINANCE</p>
                <h2 id="finance-queue-title">Bukti menunggu verifikasi</h2>
              </div>
              <span>{invoices.length} invoice</span>
            </div>

            <div className="admin-finance-list">
              {invoices.map((invoice) => {
                const saving = savingIds.has(invoice.id);
                return (
                  <article
                    className="admin-detail-section"
                    aria-label={`Invoice ${invoice.invoiceNumber}`}
                    key={invoice.id}
                  >
                    <header className="admin-detail__header">
                      <div>
                        <p className="admin-eyebrow">{invoice.invoiceNumber}</p>
                        <h3>{invoice.registration.teamName || 'Nama tim belum tersedia'}</h3>
                        <p>{invoice.registration.institution || 'Institusi belum tersedia'}</p>
                      </div>
                      <PaymentStatusNotice status={invoice.paymentStatus} />
                    </header>

                    <dl className="admin-detail-grid">
                      <div><dt>Nomor pendaftaran</dt><dd>{invoice.registration.registrationNumber || '—'}</dd></div>
                      <div><dt>Kompetisi</dt><dd>{invoice.registration.competition?.name || '—'}</dd></div>
                      <div><dt>Ketua tim</dt><dd>{invoice.registration.owner?.displayName || '—'}</dd></div>
                      <div><dt>Jumlah</dt><dd>{formatAmount(invoice.amount, invoice.currency)}</dd></div>
                      <div><dt>Batas pembayaran</dt><dd>{formatDate(invoice.deadline)}</dd></div>
                    </dl>

                    {invoice.proof && (
                      <section aria-label="Bukti pembayaran">
                        <h4>{invoice.proof.originalName}</h4>
                        <p>{invoice.proof.mimeType} · {formatFileSize(invoice.proof.size)}</p>
                        <a href={`/api/admin/finance/invoices/${encodeURIComponent(invoice.id)}/proof`}>
                          Buka bukti pembayaran
                        </a>
                      </section>
                    )}

                    <label htmlFor={`finance-reason-${invoice.id}`}>Alasan atau referensi verifikasi</label>
                    <textarea
                      id={`finance-reason-${invoice.id}`}
                      value={reasons[invoice.id] ?? ''}
                      disabled={saving}
                      onChange={(event) => {
                        const value = event.target.value;
                        setReasons((current) => ({ ...current, [invoice.id]: value }));
                        if (decisionErrors[invoice.id]) {
                          setDecisionErrors((current) => ({ ...current, [invoice.id]: '' }));
                        }
                      }}
                    />

                    {decisionErrors[invoice.id] && (
                      <p className="admin-error" role="alert">{decisionErrors[invoice.id]}</p>
                    )}

                    <div className="admin-detail-actions">
                      <button
                        className="admin-action"
                        type="button"
                        disabled={saving}
                        onClick={() => void decide(invoice.id, 'PAID')}
                      >
                        {saving ? 'Menyimpan…' : 'Tandai lunas'}
                      </button>
                      <button
                        className="admin-action"
                        type="button"
                        disabled={saving}
                        onClick={() => void decide(invoice.id, 'REJECTED')}
                      >
                        Tolak bukti
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </AdminShell>
  );
}
