import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { SiteFooter } from '../../components/public/SiteFooter';
import { SiteHeader } from '../../components/public/SiteHeader';
import { PublicTicketResult } from '../../components/ticket/PublicTicketResult';
import { registrationApi, type RegistrationApi } from '../../features/registration/api';
import {
  normalizePublicTicket,
  type PublicTicketVerification,
} from '../../features/registration/publicTicket';

interface PublicTicketVerificationPageProps {
  api?: RegistrationApi;
}

export default function PublicTicketVerificationPage({
  api = registrationApi,
}: PublicTicketVerificationPageProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const eventId = searchParams.get('eventId')?.trim() ?? '';
  const [verification, setVerification] = useState<PublicTicketVerification | null>(null);
  const [loading, setLoading] = useState(Boolean(token && eventId));
  const missingParameters = !token || !eventId;

  useEffect(() => {
    let active = true;

    if (!missingParameters && window.location.search) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.hash}`,
      );
    }

    if (missingParameters) {
      setLoading(false);
      setVerification(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setVerification(null);
    void api.tickets.verify({ token, eventId })
      .then((payload) => {
        if (active) setVerification(normalizePublicTicket(payload));
      })
      .catch(() => {
        if (active) setVerification(normalizePublicTicket({ result: 'UNKNOWN' }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, eventId, missingParameters, token]);

  return (
    <div className="site-page">
      <SiteHeader />
      <main className="portal-main portal-empty-state" aria-labelledby="ticket-verification-title">
        <p className="portal-eyebrow">VERIFICATIO TESSERAE</p>
        <h1 id="ticket-verification-title">Verifikasi tiket</h1>
        {loading && <p role="status">Memeriksa tiket…</p>}
        {!loading && missingParameters && (
          <p role="alert">Tiket tidak valid. Token atau acara tidak tersedia.</p>
        )}
        {!loading && !missingParameters && verification && (
          <PublicTicketResult verification={verification} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
