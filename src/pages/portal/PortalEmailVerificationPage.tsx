import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { PortalShell } from '../../components/portal/PortalShell';
import { useAuth } from '../../features/auth/AuthProvider';
import { registrationApi, type RegistrationApi } from '../../features/registration/api';

interface PortalEmailVerificationPageProps {
  api?: RegistrationApi;
}

const RESEND_COOLDOWN_SECONDS = 60;

export default function PortalEmailVerificationPage({
  api = registrationApi,
}: PortalEmailVerificationPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading: authLoading, refresh, user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const attemptedToken = useRef<string | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token || authLoading || attemptedToken.current === token || user?.emailVerified) return;

    attemptedToken.current = token;
    setChecking(true);
    setError('');
    api.auth.verifyEmail(token)
      .then(async () => {
        setMessage('Email berhasil diverifikasi. Anda dapat melanjutkan pendaftaran.');
        setSearchParams({}, { replace: true });
        await refresh();
      })
      .catch(() => setError('Tautan verifikasi tidak valid atau sudah kedaluwarsa.'))
      .finally(() => setChecking(false));
  }, [api, authLoading, refresh, setSearchParams, token, user?.emailVerified]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resend = useCallback(async () => {
    setResending(true);
    setError('');
    setMessage('');
    try {
      await api.auth.resendEmailVerification();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage('Email verifikasi baru telah dikirim. Periksa kotak masuk Anda.');
    } catch {
      setError('Email verifikasi gagal dikirim. Coba lagi beberapa saat.');
    } finally {
      setResending(false);
    }
  }, [api]);

  if (authLoading) {
    return (
      <PortalShell>
        <main className="portal-main">
          <section className="portal-notice" role="status">
            <span className="portal-notice__number" aria-hidden="true">XIV</span>
            <div><h1>Memeriksa sesi…</h1></div>
          </section>
        </main>
      </PortalShell>
    );
  }

  if (!user && !token && attemptedToken.current === null) {
    return <Navigate replace to="/portal/masuk" />;
  }
  if (user && user.role !== 'PARTICIPANT') return <Navigate replace to="/portal/masuk" />;
  if (user?.emailVerified && !message) return <Navigate replace to="/portal" />;

  return (
    <PortalShell>
      <main className="portal-main">
        <section className="portal-notice" aria-labelledby="verify-email-title">
          <span className="portal-notice__number" aria-hidden="true">@</span>
          <div>
            <p className="portal-eyebrow">VERIFIKASI EMAIL</p>
            <h1 id="verify-email-title">Verifikasi email Anda.</h1>
            <p>
              {user
                ? <>Kami mengirim tautan verifikasi ke <strong>{user.email}</strong>.</>
                : 'Kami sedang memverifikasi tautan email Anda.'}
              {' '}Buka tautan tersebut untuk mengaktifkan pengiriman pendaftaran.
            </p>

            {checking && <p role="status">Memverifikasi tautan…</p>}
            {message && <p role="status">{message}</p>}
            {error && <p role="alert">{error}</p>}

            {user && !user.emailVerified && (
              <div className="portal-form-actions">
                <button
                  className="portal-button portal-button--primary"
                  type="button"
                  disabled={resending || cooldown > 0}
                  onClick={() => void resend()}
                >
                  {resending
                    ? 'Mengirim…'
                    : cooldown > 0
                      ? `Kirim ulang (${cooldown}s)`
                      : 'Kirim ulang email verifikasi'}
                </button>
                <Link
                  className="portal-button"
                  to="/portal"
                  onClick={(event) => {
                    event.preventDefault();
                    void refresh().finally(() => navigate('/portal', { replace: true }));
                  }}
                >
                  Saya sudah memverifikasi
                </Link>
              </div>
            )}
            {user?.emailVerified && (
              <div className="portal-form-actions">
                <Link className="portal-button portal-button--primary" to="/portal/pendaftaran/baru">
                  Lanjutkan pendaftaran <span aria-hidden="true">→</span>
                </Link>
              </div>
            )}
            {!user && (message || error) && (
              <div className="portal-form-actions">
                <Link className="portal-button portal-button--primary" to="/portal/masuk">
                  Masuk ke portal
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
    </PortalShell>
  );
}
