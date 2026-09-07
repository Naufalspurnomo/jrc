import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import PortalLoginPage from '../../../pages/portal/PortalLoginPage';
import type { AuthSession, RegistrationApi } from '../api';

const session: AuthSession = {
  user: {
    id: 'user-1',
    displayName: 'Ari Wijaya',
    email: 'ari@example.test',
    role: 'PARTICIPANT',
  },
};

function createApi(login: RegistrationApi['auth']['login']): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockRejectedValue({ status: 401 }),
      login,
      register: vi.fn(),
      logout: vi.fn(),
    },
  } as unknown as RegistrationApi;
}

function renderLogin(api: RegistrationApi) {
  return render(
    <MemoryRouter initialEntries={['/portal/masuk']}>
      <AuthProvider api={api}>
        <Routes>
          <Route path="/portal/masuk" element={<PortalLoginPage />} />
          <Route path="/portal" element={<h1>Portal peserta</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('PortalLoginPage', () => {
  it('submits email and password then enters the participant portal', async () => {
    const login = vi.fn().mockResolvedValue(session);
    const api = createApi(login);
    const user = userEvent.setup();
    renderLogin(api);

    await screen.findByLabelText('Email');
    await user.type(screen.getByLabelText('Email'), 'ari@example.test');
    await user.type(screen.getByLabelText('Kata sandi'), 'rahasia-aman');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({
      email: 'ari@example.test',
      password: 'rahasia-aman',
    }));
    expect(await screen.findByRole('heading', { name: 'Portal peserta' })).toBeInTheDocument();
  });

  it('shows the server error and keeps the form available', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Email atau kata sandi salah.'));
    const user = userEvent.setup();
    renderLogin(createApi(login));

    await screen.findByLabelText('Email');
    await user.type(screen.getByLabelText('Email'), 'ari@example.test');
    await user.type(screen.getByLabelText('Kata sandi'), 'keliru');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email atau kata sandi salah.');
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled();
  });
});