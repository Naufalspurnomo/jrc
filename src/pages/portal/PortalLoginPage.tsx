import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../features/auth';

interface RedirectState {
  from?: {
    pathname?: string;
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Tidak dapat masuk. Periksa data Anda lalu coba lagi.';
}

export default function PortalLoginPage() {
  const { loading: authLoading, login, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!authLoading && user?.role === 'PARTICIPANT') {
    return <Navigate replace to="/portal" />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const session = await login({ email: email.trim(), password });
      if (session.user.role !== 'PARTICIPANT') {
        setError('Akun ini tidak memiliki akses ke portal peserta.');
        return;
      }
      const requestedPath = (location.state as RedirectState | null)?.from?.pathname;
      navigate(requestedPath?.startsWith('/portal') ? requestedPath : '/portal', { replace: true });
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="portal-auth">
      <section className="portal-auth__scene" aria-labelledby="portal-login-title">
        <div className="portal-auth__crest" aria-hidden="true">XIV</div>
        <p className="portal-eyebrow">PORTAL PESERTA · JRC XIV</p>
        <h1 id="portal-login-title">Masuk ke portal peserta.</h1>
        <p className="portal-auth__lead">
          Kelola pendaftaran tim, pembayaran, dan tiket dari satu akun.
        </p>

        <form className="portal-auth__form" onSubmit={submit}>
          <label htmlFor="portal-login-email">Email</label>
          <input
            id="portal-login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="portal-login-password">Kata sandi</label>
          <input
            id="portal-login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="portal-form-error" role="alert">{error}</p>}
          <button className="portal-button portal-button--primary" type="submit" disabled={submitting}>
            {submitting ? 'Memproses…' : 'Masuk'}
            {!submitting && <span aria-hidden="true">→</span>}
          </button>
        </form>
        <p className="portal-auth__account-link">
          Belum memiliki akun? <Link to="/portal/daftar">Daftar sekarang</Link>
        </p>
      </section>

      <aside className="portal-auth__aside" aria-label="Informasi portal">
        <p className="portal-eyebrow">JRC XIV · IMPERIUM MACHINA</p>
        <blockquote>Siapkan timmu untuk memasuki arena.</blockquote>
        <dl className="portal-auth__facts">
          <div><dt>Pendaftaran</dt><dd>Beberapa tim</dd></div>
          <div><dt>Berkas</dt><dd>Unggah aman</dd></div>
          <div><dt>Pembayaran</dt><dd>Verifikasi panitia</dd></div>
        </dl>
        <Link className="portal-text-link" to="/">Kembali ke arena publik</Link>
      </aside>
    </main>
  );
}
