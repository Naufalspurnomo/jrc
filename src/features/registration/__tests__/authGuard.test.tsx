import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import { RequireAuth } from '../../auth/RequireAuth';
import AdminLoginPage from '../../../pages/admin/AdminLoginPage';
import type { AuthSession, RegistrationApi } from '../api';

function anonymousApi(me: RegistrationApi['auth']['me']): RegistrationApi {
  return { auth: { me } } as unknown as RegistrationApi;
}

describe('RequireAuth', () => {
  it('handles a null session probe then redirects an anonymous participant', async () => {
    render(
      <MemoryRouter initialEntries={['/portal']}>
        <AuthProvider api={anonymousApi(vi.fn().mockResolvedValue({ user: null }))}>
          <Routes>
            <Route path="/portal/masuk" element={<h1>Masuk peserta</h1>} />
            <Route element={<RequireAuth roles={['PARTICIPANT']} redirectTo="/portal/masuk" />}>
              <Route path="/portal" element={<h1>Dashboard rahasia</h1>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Memeriksa sesi');
    expect(await screen.findByRole('heading', { name: 'Masuk peserta' })).toBeInTheDocument();
    expect(screen.queryByText('Dashboard rahasia')).not.toBeInTheDocument();
  });

  it('preserves the 401 fallback for older auth endpoints', async () => {
    render(
      <MemoryRouter initialEntries={['/portal']}>
        <AuthProvider api={anonymousApi(vi.fn().mockRejectedValue({ status: 401 }))}>
          <Routes>
            <Route path="/portal/masuk" element={<h1>Masuk peserta</h1>} />
            <Route element={<RequireAuth roles={['PARTICIPANT']} redirectTo="/portal/masuk" />}>
              <Route path="/portal" element={<h1>Dashboard rahasia</h1>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Masuk peserta' })).toBeInTheDocument();
    expect(screen.queryByText('Dashboard rahasia')).not.toBeInTheDocument();
  });

  it('invalidates an authenticated admin after a protected 401 and explains session expiry', async () => {
    const adminSession: AuthSession = {
      user: {
        id: 'admin-1',
        displayName: 'Panitia JRC',
        email: 'admin@example.test',
        role: 'SUPER_ADMIN',
        emailVerified: true,
      },
    };
    let notifyUnauthorized: (() => void) | undefined;
    const api = {
      auth: {
        me: vi.fn().mockResolvedValue(adminSession),
        onUnauthorized: (listener: () => void) => {
          notifyUnauthorized = listener;
          return () => undefined;
        },
      },
    } as unknown as RegistrationApi;

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider api={api}>
          <Routes>
            <Route path="/admin/masuk" element={<AdminLoginPage />} />
            <Route element={<RequireAuth roles={['SUPER_ADMIN']} redirectTo="/admin/masuk" />}>
              <Route path="/admin" element={<h1>Dashboard admin</h1>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard admin' })).toBeInTheDocument();
    notifyUnauthorized?.();

    expect(await screen.findByRole('heading', { name: 'Masuk ke meja panitia.' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sesi admin Anda telah berakhir. Masuk kembali untuk melanjutkan.',
    );
  });
});