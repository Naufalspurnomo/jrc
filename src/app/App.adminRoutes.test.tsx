import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../features/auth';
import type { AuthRole, AuthSession, RegistrationApi } from '../features/registration/api';
import { AppRoutes } from './App';

vi.mock('../pages/admin/AdminLoginPage', () => ({
  default: () => <h1>Masuk admin</h1>,
}));
vi.mock('../pages/admin/AdminDashboardPage', () => ({
  default: () => <h1>Pendaftaran admin</h1>,
}));
vi.mock('../pages/admin/AdminRegistrationDetailPage', () => ({
  default: () => <h1>Detail pendaftaran admin</h1>,
}));
vi.mock('../pages/admin/AdminFinancePage', () => ({
  default: () => <h1>Finance admin</h1>,
}));
vi.mock('../pages/admin/AdminScannerPage', () => ({
  default: () => <h1>Scanner admin</h1>,
}));

function session(role: AuthRole): AuthSession {
  return {
    user: {
      id: `user-${role}`,
      displayName: 'Panitia Uji',
      email: `${role.toLowerCase()}@example.test`,
      role,
    },
  };
}

function renderRoute(path: string, role: AuthRole) {
  const api = {
    auth: {
      me: vi.fn().mockResolvedValue(session(role)),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    },
  } as unknown as RegistrationApi;

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider api={api}>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('admin route authorization', () => {
  it.each([
    ['/admin', 'REGISTRATION_REVIEWER', 'Pendaftaran admin'],
    ['/admin/pendaftaran/registration-1', 'SUPPORT', 'Detail pendaftaran admin'],
    ['/admin/finance', 'FINANCE', 'Finance admin'],
    ['/admin/scanner', 'GATE_STAFF', 'Scanner admin'],
    ['/admin/finance', 'SUPER_ADMIN', 'Finance admin'],
    ['/admin/scanner', 'REGISTRATION_REVIEWER', 'Masuk admin'],
    ['/admin', 'FINANCE', 'Masuk admin'],
    ['/admin/finance', 'GATE_STAFF', 'Masuk admin'],
    ['/admin', 'PARTICIPANT', 'Masuk admin'],
  ] as const)('routes %s for %s to %s', async (path, role, heading) => {
    renderRoute(path, role);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});