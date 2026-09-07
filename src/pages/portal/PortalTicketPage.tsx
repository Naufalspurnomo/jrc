import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

import { PortalShell } from '../../components/portal/PortalShell';
import {
  ApiError,
  registrationApi,
  type RegistrationApi,
  type RegistrationRecord,
  type TicketRecord,
} from '../../features/registration/api';

interface PortalTicketPageProps {
  api?: RegistrationApi;
}

const ticketStatusLabel: Record<NonNullable<TicketRecord['status']>, string> = {
  INACTIVE: 'Belum aktif',
  ACTIVE: 'Aktif',
  CHECKED_IN: 'Sudah check-in',
  REVOKED: 'Dicabut',
};

export default function PortalTicketPage({ api = registrationApi }: PortalTicketPageProps) {
  const { registrationId } = useParams<{ registrationId: string }>();
  const qrRef = useRef<SVGSVGElement>(null);
  const [registration, setRegistration] = useState<RegistrationRecord | null>(null);
  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notIssued, setNotIssued] = useState(false);
  const [error, setError] = useState('');

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
    setNotIssued(false);
    void Promise.all([
      api.registrations.get(registrationId),
      api.registrations.ticket(registrationId),
    ])
      .then(([registrationRecord, ticketRecord]) => {
        if (!active) return;
        setRegistration(registrationRecord);
        setTicket(ticketRecord);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        if (loadError instanceof ApiError && loadError.status === 409) {
          setNotIssued(true);
        } else {
          setError('Tiket gagal dimuat. Silakan coba lagi.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, registrationId]);

  const downloadTicket = () => {
    const svg = qrRef.current;
    if (!svg) return;

    const source = new XMLSerializer().serializeToString(svg);
    const objectUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'jrc-xiv-ticket.svg';
      anchor.click();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const teamName = ticket?.teamName ?? registration?.teamName;
  const registrationNumber = ticket?.registrationNumber ?? registration?.registrationNumber;
  const competitionName = ticket?.competitionName ?? registration?.competition?.name;
  const eventName = ticket?.eventName ?? registration?.competition?.eventName;
  const status = ticket?.status ?? registration?.ticketStatus;

  return (
    <PortalShell>
      <main className="portal-main portal-registration">
        <header className="portal-registration__header">
          <div>
            <p className="portal-eyebrow">TESSERA ADMISSIONIS</p>
            <h1>Tiket {teamName ?? ''}</h1>
          </div>
          <p>Tunjukkan kode QR ini kepada petugas saat memasuki acara.</p>
        </header>

        {loading && <p role="status">Memuat tiket…</p>}
        {!loading && notIssued && (
          <section className="portal-notice" role="status">
            <span className="portal-notice__number" aria-hidden="true">!</span>
            <div>
              <h2>Tiket belum diterbitkan.</h2>
              <p>Tiket tersedia setelah pendaftaran dan pembayaran memenuhi ketentuan panitia.</p>
            </div>
          </section>
        )}
        {!loading && error && <p role="alert">{error}</p>}

        {!loading && !error && !notIssued && registration && ticket && (
          <section className="portal-dashboard-grid" aria-labelledby="ticket-detail-title">
            <article className="portal-progress-panel">
              <div className="portal-panel-heading">
                <div>
                  <p className="portal-eyebrow">KODE MASUK</p>
                  <h2 id="ticket-detail-title">Tiket digital</h2>
                </div>
              </div>
              <QRCodeSVG
                ref={qrRef}
                value={ticket.verificationUrl}
                size={256}
                marginSize={2}
                role="img"
                aria-label="Kode QR verifikasi tiket"
              />
              <p>Kode QR hanya memuat URL verifikasi dari sistem, tanpa data pribadi peserta.</p>
              <button className="portal-button portal-button--primary" type="button" onClick={downloadTicket}>
                Unduh QR tiket
              </button>
            </article>

            <article className="portal-summary-panel">
              <h2>Detail tiket</h2>
              <dl>
                {teamName && <div><dt>Tim</dt><dd>{teamName}</dd></div>}
                {registrationNumber && <div><dt>Nomor pendaftaran</dt><dd>{registrationNumber}</dd></div>}
                {competitionName && <div><dt>Kompetisi</dt><dd>{competitionName}</dd></div>}
                {eventName && <div><dt>Acara</dt><dd>{eventName}</dd></div>}
                {status && <div><dt>Status</dt><dd>{ticketStatusLabel[status]}</dd></div>}
              </dl>
            </article>
          </section>
        )}
      </main>
    </PortalShell>
  );
}
