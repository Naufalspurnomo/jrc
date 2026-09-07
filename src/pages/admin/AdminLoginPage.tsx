import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../../features/auth';
import type { AuthRole } from '../../features/registration/api';

const STAFF_ROLES: readonly AuthRole[] = [
  'SUPER_ADMIN',
  'REGISTRATION_REVIEWER',
  'FINANCE',
  'GATE_STAFF',
  'SUPPORT',
];

function destinationForRole(role: AuthRole): string {
  if (role === 'FINANCE') return '/admin/finance';
  if (role === 'GATE_STAFF') return '/admin/scanner';
  return '/admin';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Tidak dapat masuk. Periksa data Anda lalu coba lagi.';
}

export default function AdminLoginPage() {
  const { loading: authLoading, login, logout, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!authLoading && user && STAFF_ROLES.includes(user.role)) {
    return <Navigate replace to={destinationForRole(user.role)} />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const session = await login({ email: email.trim(), password });
      if (!STAFF_ROLES.includes(session.user.role)) {
        try {
          await logout();
        } finally {
          setError('Akun peserta tidak memiliki akses ke sistem panitia.');
        }
        return;
      }
      navigate(destinationForRole(session.user.role), { replace: true });
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="portal-auth">
      <section className="portal-auth__scene" aria-labelledby="admin-login-title">
        <div className="portal-auth__crest" aria-hidden="true">XIV</div>
        <p className="portal-eyebrow">SISTEM PANITIA · JRC XIV</p>
        <h1 id="admin-login-title">Masuk ke meja panitia.</h1>
        <p className="portal-auth__lead">
          Kelola pendaftaran, pembayaran, dan akses gerbang sesuai peran Anda.
        </p>

        <form className="portal-auth__form" onSubmit={submit}>
          <label htmlFor="admin-login-email">Email</label>
          <input
            id="admin-login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="admin-login-password">Kata sandi</label>
          <input
            id="admin-login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="portal-form-error" role="alert">{error}</p>}
          <button
            className="portal-button portal-button--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Memproses…' : 'Masuk'}
            {!submitting && <span aria-hidden="true">→</span>}
          </button>
        </form>
      </section>

      <aside className="portal-auth__aside" aria-label="Informasi sistem panitia">
        <p className="portal-eyebrow">OFFICIUM · IMPERIUM MACHINA</p>
        <blockquote>Satu pusat kendali untuk seluruh arena.</blockquote>
        <dl className="portal-auth__facts">
          <div><dt>Pendaftaran</dt><dd>Telaah terpusat</dd></div>
          <div><dt>Keuangan</dt><dd>Verifikasi pembayaran</dd></div>
          <div><dt>Gerbang</dt><dd>Pemindaian tiket</dd></div>
        </dl>
        <Link className="portal-text-link" to="/">Kembali ke arena publik</Link>
      </aside>
    </main>
  );
}
