import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import PortalSignupPage from '../../../pages/portal/PortalSignupPage';
import type { AuthSession, RegistrationApi } from '../api';

const session: AuthSession = {
  user: {
    id: 'user-1',
    displayName: 'Ari Wijaya',
    email: 'ari@example.test',
    role: 'PARTICIPANT',
    emailVerified: false,
  },
};

function createApi(register: RegistrationApi['auth']['register']): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockRejectedValue({ status: 401 }),
      login: vi.fn(),
      register,
      logout: vi.fn(),
      verifyEmail: vi.fn(),
      resendEmailVerification: vi.fn(),
    },
  } as unknown as RegistrationApi;
}

function renderSignup(api: RegistrationApi) {
  return render(
    <MemoryRouter initialEntries={['/portal/daftar']}>
      <AuthProvider api={api}>
        <Routes>
          <Route path="/portal/daftar" element={<PortalSignupPage />} />
          <Route path="/portal" element={<h1>Portal peserta</h1>} />
          <Route path="/portal/verifikasi-email" element={<h1>Verifikasi email Anda</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('PortalSignupPage', () => {
  it('registers a participant then requests email verification', async () => {
    const register = vi.fn().mockResolvedValue(session);
    const user = userEvent.setup();
    renderSignup(createApi(register));

    await screen.findByLabelText('Nama lengkap');
    await user.type(screen.getByLabelText('Nama lengkap'), '  Ari Wijaya  ');
    await user.type(screen.getByLabelText('Email'), '  ari@example.test  ');
    await user.type(screen.getByLabelText('Kata sandi'), 'rahasia-aman');
    await user.type(screen.getByLabelText('Konfirmasi kata sandi'), 'rahasia-aman');
    await user.click(screen.getByRole('button', { name: 'Daftar' }));

    await waitFor(() => expect(register).toHaveBeenCalledWith({
      displayName: 'Ari Wijaya',
      email: 'ari@example.test',
      password: 'rahasia-aman',
    }));
    expect(await screen.findByRole('heading', { name: 'Verifikasi email Anda' })).toBeInTheDocument();
  });

  it('validates participant details before registration', async () => {
    const register = vi.fn();
    const user = userEvent.setup();
    renderSignup(createApi(register));

    await screen.findByLabelText('Nama lengkap');
    await user.type(screen.getByLabelText('Nama lengkap'), ' ');
    await user.type(screen.getByLabelText('Email'), 'email-tidak-valid');
    await user.type(screen.getByLabelText('Kata sandi'), 'pendek');
    await user.type(screen.getByLabelText('Konfirmasi kata sandi'), 'berbeda');
    await user.click(screen.getByRole('button', { name: 'Daftar' }));

    expect(await screen.findByText('Nama lengkap wajib diisi.')).toBeInTheDocument();
    expect(screen.getByText('Masukkan alamat email yang valid.')).toBeInTheDocument();
    expect(screen.getByText('Kata sandi minimal 8 karakter.')).toBeInTheDocument();
    expect(screen.getByText('Konfirmasi kata sandi tidak sama.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('shows pending state and a server error without leaving the form', async () => {
    let rejectRegistration: ((reason: Error) => void) | undefined;
    const register = vi.fn().mockImplementation(() => new Promise<AuthSession>((_resolve, reject) => {
      rejectRegistration = reject;
    }));
    const user = userEvent.setup();
    renderSignup(createApi(register));

    await screen.findByLabelText('Nama lengkap');
    await user.type(screen.getByLabelText('Nama lengkap'), 'Ari Wijaya');
    await user.type(screen.getByLabelText('Email'), 'ari@example.test');
    await user.type(screen.getByLabelText('Kata sandi'), 'rahasia-aman');
    await user.type(screen.getByLabelText('Konfirmasi kata sandi'), 'rahasia-aman');
    await user.click(screen.getByRole('button', { name: 'Daftar' }));

    expect(screen.getByRole('button', { name: 'Memproses…' })).toBeDisabled();
    rejectRegistration?.(new Error('Email sudah terdaftar.'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email sudah terdaftar.');
    expect(screen.getByRole('button', { name: 'Daftar' })).toBeEnabled();
  });
});
