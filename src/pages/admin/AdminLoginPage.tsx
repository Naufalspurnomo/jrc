import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../../features/auth';
import type { AuthRole } from '../../features/registration/api';

const STAFF_ROLES: readonly AuthRole[] = [
  'SUPER_ADMIN',
  'REGISTRATION_REVIEWER',
  'FINANCE',
  'PAID_TEAM_VIEWER',
  'GATE_STAFF',
  'SUPPORT',
];

function destinationForRole(role: AuthRole): string {
  if (role === 'FINANCE') return '/admin/finance';
  if (role === 'PAID_TEAM_VIEWER') return '/admin/tim-lunas';
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
    <main className="admin-login">
      <section className="admin-login__form-panel" aria-labelledby="admin-login-title">
        <div className="admin-login__brand"><span aria-hidden="true">XIV</span> JRC XIV</div>
        <p className="admin-login__eyebrow">Sistem panitia</p>
        <h1 id="admin-login-title">Masuk ke meja panitia.</h1>
        <p className="admin-login__lead">
          Kelola pendaftaran, pembayaran, dan akses gerbang sesuai peran Anda.
        </p>

        <form className="admin-login__form" aria-label="Masuk ke sistem panitia" onSubmit={submit}>
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

      <aside className="admin-login__aside" aria-label="Informasi sistem panitia">
        <p className="admin-login__eyebrow">Cakupan akses</p>
        <h2>Pusat kerja panitia<br />JRC XIV</h2>
        <dl className="admin-login__facts">
          <div><dt>Pendaftaran</dt><dd>Telaah terpusat</dd></div>
          <div><dt>Keuangan</dt><dd>Verifikasi pembayaran</dd></div>
          <div><dt>Gerbang</dt><dd>Pemindaian tiket</dd></div>
        </dl>
        <Link className="portal-text-link" to="/">Kembali ke situs publik</Link>
      </aside>
    </main>
  );
}
