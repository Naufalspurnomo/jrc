import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import { RequireAuth } from '../../auth/RequireAuth';
import type { RegistrationApi } from '../api';

const anonymousApi = {
  auth: { me: vi.fn().mockRejectedValue({ status: 401 }) },
} as unknown as RegistrationApi;

describe('RequireAuth', () => {
  it('waits for session resolution then redirects an anonymous participant', async () => {
    render(
      <MemoryRouter initialEntries={['/portal']}>
        <AuthProvider api={anonymousApi}>
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
});