import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { registrationApi, type RegistrationApi } from '../../features/registration/api';

interface PortalResetPasswordPageProps {
  api?: RegistrationApi;
}

function safeError(error: unknown): string {
  if (error instanceof Error && /invalid or expired/i.test(error.message)) {
    return 'Tautan reset tidak valid atau sudah kedaluwarsa.';
  }
  return 'Kata sandi belum dapat diganti. Coba lagi beberapa saat lagi.';
}

export default function PortalResetPasswordPage({ api = registrationApi }: PortalResetPasswordPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token')?.trim() ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const validTokenShape = /^[A-Za-z0-9_-]{43}$/.test(token);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.resetPassword(token, password);
      navigate('/portal/masuk', { replace: true, state: { passwordReset: true } });
    } catch (nextError) {
      setError(safeError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="portal-auth">
      <section className="portal-auth__scene" aria-labelledby="reset-password-title">
        <div className="portal-auth__crest" aria-hidden="true">XIV</div>
        <p className="portal-eyebrow">PEMULIHAN AKUN · JRC XIV</p>
        <h1 id="reset-password-title">Atur kata sandi baru.</h1>
        {!validTokenShape ? (
          <div className="portal-auth__notice" role="alert">
            <p>Tautan reset tidak valid atau tidak lengkap.</p>
            <Link className="portal-button portal-button--primary" to="/portal/lupa-kata-sandi">Minta tautan baru</Link>
          </div>
        ) : (
          <form className="portal-auth__form" onSubmit={submit}>
            <label htmlFor="reset-password">Kata sandi baru</label>
            <input id="reset-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <label htmlFor="reset-password-confirmation">Ulangi kata sandi baru</label>
            <input id="reset-password-confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            {error && <p className="portal-form-error" role="alert">{error}</p>}
            <button className="portal-button portal-button--primary" type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Simpan kata sandi baru'}
            </button>
          </form>
        )}
      </section>
      <aside className="portal-auth__aside" aria-label="Informasi keamanan">
        <p className="portal-eyebrow">KEAMANAN AKUN</p>
        <blockquote>Buat akses baru yang aman.</blockquote>
        <p>Gunakan sedikitnya delapan karakter dan jangan gunakan kembali kata sandi akun lain.</p>
      </aside>
    </main>
  );
}
