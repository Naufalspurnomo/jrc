import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';

import { PaymentStatusNotice } from '../../components/portal/PaymentStatusNotice';
import { PortalShell } from '../../components/portal/PortalShell';
import {
  registrationApi,
  type InvoiceRecord,
  type RegistrationApi,
  type RegistrationRecord,
} from '../../features/registration/api';

interface PortalPaymentPageProps {
  api?: RegistrationApi;
}

const proofTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function instruction(invoice: InvoiceRecord, key: string): string | undefined {
  const value = invoice.instructions[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

export default function PortalPaymentPage({ api = registrationApi }: PortalPaymentPageProps) {
  const { registrationId } = useParams<{ registrationId: string }>();
  const [registration, setRegistration] = useState<RegistrationRecord | null>(null);
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    let active = true;

    if (!registrationId) {
      setError('Pendaftaran tidak valid.');
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError('');
    void Promise.all([
      api.registrations.get(registrationId),
      api.registrations.invoice(registrationId),
    ])
      .then(([registrationRecord, invoiceRecord]) => {
        if (!active) return;
        setRegistration(registrationRecord);
        setInvoice(invoiceRecord);
      })
      .catch(() => {
        if (active) setError('Detail pembayaran gagal dimuat. Silakan coba lagi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, registrationId]);

  const uploadProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!invoice || !proof) {
      setUploadError('Pilih bukti pembayaran terlebih dahulu.');
      return;
    }
    if (!proofTypes.has(proof.type)) {
      setUploadError('Format bukti harus PDF, JPEG, atau PNG.');
      return;
    }

    const formData = new FormData();
    formData.append('file', proof);
    setUploading(true);
    setUploadError('');
    try {
      const updatedInvoice = await api.invoices.uploadProof(invoice.id, formData);
      setInvoice(updatedInvoice);
      setProof(null);
    } catch {
      setUploadError('Bukti pembayaran gagal diunggah. Silakan coba lagi.');
    } finally {
      setUploading(false);
    }
  };

  const bankName = invoice ? instruction(invoice, 'bankName') : undefined;
  const accountName = invoice
    ? instruction(invoice, 'bankAccountName') ?? instruction(invoice, 'accountName')
    : undefined;
  const accountNumber = invoice
    ? instruction(invoice, 'bankAccountNumber') ?? instruction(invoice, 'accountNumber')
    : undefined;
  const qrisImageUrl = invoice ? instruction(invoice, 'qrisImageUrl') : undefined;
  const transferReference = invoice ? instruction(invoice, 'transferReference') : undefined;

  return (
    <PortalShell>
      <main className="portal-main portal-registration">
        <header className="portal-registration__header">
          <div>
            <p className="portal-eyebrow">SOLUTIO MANUALIS</p>
            <h1>Pembayaran {registration?.teamName ?? ''}</h1>
          </div>
          <p>Ikuti instruksi transfer manual, lalu unggah bukti pembayaran.</p>
        </header>

        {loading && <p role="status">Memuat detail pembayaran…</p>}
        {!loading && error && <p role="alert">{error}</p>}

        {!loading && !error && registration && invoice && (
          <>
            <section className="portal-summary-panel" aria-labelledby="payment-detail-title">
              <div className="portal-panel-heading">
                <div>
                  <p className="portal-eyebrow">{invoice.invoiceNumber}</p>
                  <h2 id="payment-detail-title">Instruksi pembayaran</h2>
                </div>
              </div>
              <dl>
                <div><dt>Jumlah</dt><dd>{formatAmount(invoice.amount, invoice.currency)}</dd></div>
                <div><dt>Batas pembayaran</dt><dd>{formatDeadline(invoice.deadline)} WIB</dd></div>
                {bankName && <div><dt>Bank</dt><dd>{bankName}</dd></div>}
                {accountName && <div><dt>Nama rekening</dt><dd>{accountName}</dd></div>}
                {accountNumber && <div><dt>Nomor rekening</dt><dd>{accountNumber}</dd></div>}
                {transferReference && <div><dt>Referensi transfer</dt><dd>{transferReference}</dd></div>}
              </dl>
              {qrisImageUrl && (
                <img src={qrisImageUrl} alt={`Kode QRIS untuk ${invoice.invoiceNumber}`} />
              )}
            </section>

            <div className="portal-form-panel">
              <PaymentStatusNotice status={invoice.paymentStatus} />
              <p>
                Bukti yang diunggah berstatus menunggu verifikasi dan belum dinyatakan lunas
                sampai tim keuangan menyelesaikan pemeriksaan riwayat transaksi bank.
              </p>

              {invoice.paymentStatus !== 'PAID' && invoice.paymentStatus !== 'REFUNDED' && (
                <form onSubmit={uploadProof}>
                  <fieldset className="portal-fieldset">
                    <legend><span>II</span> Bukti pembayaran</legend>
                    <label className="portal-file-field">
                      Bukti pembayaran (PDF, JPEG, atau PNG)
                      <input
                        accept="application/pdf,image/jpeg,image/png"
                        type="file"
                        onChange={(event) => {
                          setProof(event.target.files?.[0] ?? null);
                          setUploadError('');
                        }}
                      />
                    </label>
                    {proof && <p>{proof.name}</p>}
                    {uploadError && <p role="alert">{uploadError}</p>}
                    <button className="portal-button portal-button--primary" disabled={uploading} type="submit">
                      {uploading ? 'Mengunggah…' : 'Unggah bukti'}
                    </button>
                  </fieldset>
                </form>
              )}
            </div>
          </>
        )}
      </main>
    </PortalShell>
  );
}
