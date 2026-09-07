import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import PortalDashboardPage from '../../../pages/portal/PortalDashboardPage';
import type { AuthSession, RegistrationApi, RegistrationRecord } from '../api';

const session: AuthSession = {
  user: {
    id: 'user-1',
    displayName: 'Ari Wijaya',
    email: 'ari@example.test',
    role: 'PARTICIPANT',
  },
};

function registration(id: string, teamName: string, status: RegistrationRecord['status']): RegistrationRecord {
  return {
    id,
    registrationNumber: `JRC-${id}`,
    competitionId: 'competition-1',
    competition: { id: 'competition-1', name: 'Ring Rumble — Sumo' },
    teamName,
    institution: 'PENS',
    status,
    paymentStatus: status === 'APPROVED' ? 'UNPAID' : undefined,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };
}

function createApi(registrations: RegistrationRecord[]): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue(session),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    },
    registrations: {
      list: vi.fn().mockResolvedValue(registrations),
    },
  } as unknown as RegistrationApi;
}

function renderDashboard(api: RegistrationApi) {
  render(
    <MemoryRouter>
      <AuthProvider api={api}>
        <PortalDashboardPage api={api} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('PortalDashboardPage', () => {
  it('renders every registration with status, payment, and contextual actions', async () => {
    const api = createApi([
      registration('001', 'Garuda Robotika', 'DRAFT'),
      registration('002', 'Rajawali Mesin', 'APPROVED'),
    ]);
    renderDashboard(api);

    expect(await screen.findByRole('heading', { name: 'Garuda Robotika' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rajawali Mesin' })).toBeInTheDocument();
    expect(screen.getByText('Belum lunas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /lanjutkan garuda robotika/i })).toHaveAttribute(
      'href',
      '/portal/pendaftaran/001',
    );
    expect(screen.getByRole('link', { name: /pembayaran rajawali mesin/i })).toHaveAttribute(
      'href',
      '/portal/pendaftaran/002/pembayaran',
    );
  });

  it('shows a create action when the participant has no registrations', async () => {
    renderDashboard(createApi([]));

    expect(await screen.findByRole('heading', { name: 'Belum ada pendaftaran.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buat pendaftaran' })).toHaveAttribute(
      'href',
      '/portal/pendaftaran/baru',
    );
  });
});