import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import { RequireAuth } from '../../auth/RequireAuth';
import type { RegistrationApi } from '../api';

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
});