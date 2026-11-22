import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { registrationApi, type RegistrationApi } from '../../features/registration/api';

interface PortalForgotPasswordPageProps {
  api?: RegistrationApi;
}

const genericMessage = 'Jika email terdaftar dan memenuhi syarat, tautan reset akan dikirim.';

export default function PortalForgotPasswordPage({ api = registrationApi }: PortalForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.auth.forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError('Permintaan belum dapat diproses. Periksa koneksi lalu coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="portal-auth">
      <section className="portal-auth__scene" aria-labelledby="forgot-password-title">
        <div className="portal-auth__crest" aria-hidden="true">XIV</div>
        <p className="portal-eyebrow">PEMULIHAN AKUN · JRC XIV</p>
        <h1 id="forgot-password-title">Lupa kata sandi?</h1>
        <p className="portal-auth__lead">Masukkan email akun peserta. Tautan penggantian kata sandi berlaku selama satu jam.</p>
        {sent ? (
          <div className="portal-auth__notice" role="status">
            <p>{genericMessage}</p>
            <Link className="portal-button portal-button--primary" to="/portal/masuk">Kembali ke halaman masuk</Link>
          </div>
        ) : (
          <form className="portal-auth__form" onSubmit={submit}>
            <label htmlFor="forgot-password-email">Email</label>
            <input id="forgot-password-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            {error && <p className="portal-form-error" role="alert">{error}</p>}
            <button className="portal-button portal-button--primary" type="submit" disabled={submitting}>
              {submitting ? 'Mengirim…' : 'Kirim tautan reset'}
            </button>
          </form>
        )}
        {!sent && <p className="portal-auth__account-link"><Link to="/portal/masuk">Kembali ke halaman masuk</Link></p>}
      </section>
      <aside className="portal-auth__aside" aria-label="Informasi keamanan">
        <p className="portal-eyebrow">KEAMANAN AKUN</p>
        <blockquote>Satu tautan. Satu kali penggunaan.</blockquote>
        <p>Tautan lama tidak dapat digunakan kembali. Semua sesi akun akan dihentikan setelah kata sandi berhasil diganti.</p>
      </aside>
    </main>
  );
}
