import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../../features/auth';

interface ValidationErrors {
  displayName?: string;
  email?: string;
  password?: string;
  passwordConfirmation?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Tidak dapat membuat akun. Periksa data Anda lalu coba lagi.';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function PortalSignupPage() {
  const { loading: authLoading, register, user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signupNavigationPending, setSignupNavigationPending] = useState(false);

  if (!authLoading && user?.role === 'PARTICIPANT' && !signupNavigationPending) {
    return <Navigate replace to="/portal" />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedDisplayName = displayName.trim();
    const trimmedEmail = email.trim();
    const nextErrors: ValidationErrors = {};

    if (!trimmedDisplayName) nextErrors.displayName = 'Nama lengkap wajib diisi.';
    if (!isValidEmail(trimmedEmail)) nextErrors.email = 'Masukkan alamat email yang valid.';
    if (password.length < 8) nextErrors.password = 'Kata sandi minimal 8 karakter.';
    if (passwordConfirmation !== password) {
      nextErrors.passwordConfirmation = 'Konfirmasi kata sandi tidak sama.';
    }

    setValidationErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSignupNavigationPending(true);
    try {
      await register({
        displayName: trimmedDisplayName,
        email: trimmedEmail,
        password,
      });
      navigate('/portal/pendaftaran/baru', { replace: true });
    } catch (error) {
      setSignupNavigationPending(false);
      setServerError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="portal-auth">
      <section className="portal-auth__scene" aria-labelledby="portal-signup-title">
        <div className="portal-auth__crest" aria-hidden="true">XIV</div>
        <p className="portal-eyebrow">PORTAL PESERTA · JRC XIV</p>
        <h1 id="portal-signup-title">Buat akun peserta.</h1>
        <p className="portal-auth__lead">
          Daftarkan akun untuk mengelola tim, pembayaran, dan tiket Anda.
        </p>

        <form className="portal-auth__form" onSubmit={submit} noValidate>
          <label htmlFor="portal-signup-name">Nama lengkap</label>
          <input
            id="portal-signup-name"
            type="text"
            autoComplete="name"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          {validationErrors.displayName && <p className="portal-form-error">{validationErrors.displayName}</p>}

          <label htmlFor="portal-signup-email">Email</label>
          <input
            id="portal-signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {validationErrors.email && <p className="portal-form-error">{validationErrors.email}</p>}

          <label htmlFor="portal-signup-password">Kata sandi</label>
          <input
            id="portal-signup-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {validationErrors.password && <p className="portal-form-error">{validationErrors.password}</p>}

          <label htmlFor="portal-signup-password-confirmation">Konfirmasi kata sandi</label>
          <input
            id="portal-signup-password-confirmation"
            type="password"
            autoComplete="new-password"
            required
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
          />
          {validationErrors.passwordConfirmation && (
            <p className="portal-form-error">{validationErrors.passwordConfirmation}</p>
          )}

          {serverError && <p className="portal-form-error" role="alert">{serverError}</p>}
          <button className="portal-button portal-button--primary" type="submit" disabled={submitting}>
            {submitting ? 'Memproses…' : 'Daftar'}
            {!submitting && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <p className="portal-auth__account-link">
          Sudah memiliki akun? <Link to="/portal/masuk">Masuk</Link>
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
