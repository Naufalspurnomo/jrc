import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import AdminLoginPage from '../../../pages/admin/AdminLoginPage';
import type { AuthRole, AuthSession, RegistrationApi } from '../api';

function session(role: AuthRole): AuthSession {
  return {
    user: {
      id: `user-${role}`,
      displayName: 'Panitia JRC',
      email: 'panitia@example.test',
      role,
    },
  };
}

function createApi(role: AuthRole): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockRejectedValue({ status: 401 }),
      login: vi.fn().mockResolvedValue(session(role)),
      register: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as RegistrationApi;
}

function renderLogin(api: RegistrationApi) {
  return render(
    <MemoryRouter initialEntries={['/admin/masuk']}>
      <AuthProvider api={api}>
        <Routes>
          <Route path="/admin/masuk" element={<AdminLoginPage />} />
          <Route path="/admin" element={<h1>Dashboard admin</h1>} />
          <Route path="/admin/finance" element={<h1>Dashboard finance</h1>} />
          <Route path="/admin/scanner" element={<h1>Scanner gerbang</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function submitCredentials() {
  const user = userEvent.setup();
  await screen.findByLabelText('Email');
  await user.type(screen.getByLabelText('Email'), ' panitia@example.test ');
  await user.type(screen.getByLabelText('Kata sandi'), 'rahasia-aman');
  await user.click(screen.getByRole('button', { name: 'Masuk' }));
}

describe('AdminLoginPage', () => {
  it.each([
    ['SUPER_ADMIN', 'Dashboard admin'],
    ['REGISTRATION_REVIEWER', 'Dashboard admin'],
    ['SUPPORT', 'Dashboard admin'],
    ['FINANCE', 'Dashboard finance'],
    ['GATE_STAFF', 'Scanner gerbang'],
  ] as const)('accepts the %s staff role', async (role, destination) => {
    const api = createApi(role);
    renderLogin(api);

    await submitCredentials();

    expect(api.auth.login).toHaveBeenCalledWith({
      email: 'panitia@example.test',
      password: 'rahasia-aman',
    });
    expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
  });

  it('rejects a participant session, logs it out, and explains the restriction', async () => {
    const api = createApi('PARTICIPANT');
    renderLogin(api);

    await submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Akun peserta tidak memiliki akses ke sistem panitia.',
    );
    await waitFor(() => expect(api.auth.logout).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Dashboard admin' })).not.toBeInTheDocument();
  });

  it('shows an authentication error and keeps the form available', async () => {
    const api = createApi('SUPER_ADMIN');
    vi.mocked(api.auth.login).mockRejectedValue(new Error('Email atau kata sandi salah.'));
    renderLogin(api);

    await submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent('Email atau kata sandi salah.');
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled();
  });
});
