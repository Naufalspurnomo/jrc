import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import AdminDashboardPage from '../../../pages/admin/AdminDashboardPage';
import type { AuthSession, RegistrationApi, RegistrationRecord } from '../api';

const adminSession: AuthSession = {
  user: {
    id: 'admin-1',
    displayName: 'Rina Reviewer',
    email: 'rina@example.test',
    role: 'REGISTRATION_REVIEWER',
  },
};

function registration(
  id: string,
  teamName: string,
  status: RegistrationRecord['status'],
): RegistrationRecord {
  return {
    id,
    registrationNumber: `JRC-${id}`,
    competitionId: 'competition-1',
    competition: { id: 'competition-1', name: 'Colosseum Clash — Sumo' },
    teamName,
    institution: 'PENS',
    status,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };
}

function createApi(registrations: RegistrationRecord[]): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue(adminSession),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    },
    admin: {
      listRegistrations: vi.fn().mockResolvedValue(registrations),
      exportRegistrations: vi.fn().mockResolvedValue('registrationNumber,teamName\nJRC-001,Garuda'),
    },
  } as unknown as RegistrationApi;
}

function renderDashboard(api: RegistrationApi) {
  return render(
    <MemoryRouter>
      <AuthProvider api={api}>
        <AdminDashboardPage api={api} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminDashboardPage', () => {
  it('loads registrations from the admin API and links to each review detail', async () => {
    const api = createApi([
      registration('001', 'Garuda Robotika', 'SUBMITTED'),
      registration('002', 'Rajawali Mesin', 'APPROVED'),
    ]);
    renderDashboard(api);

    expect(await screen.findByRole('status')).toHaveTextContent('Memuat pendaftaran');
    const garudaRow = (await screen.findByText('Garuda Robotika')).closest('tr');
    const rajawaliRow = screen.getByText('Rajawali Mesin').closest('tr');
    expect(garudaRow).not.toBeNull();
    expect(rajawaliRow).not.toBeNull();
    expect(within(garudaRow!).getByText('Terkirim', { selector: '.portal-status' })).toBeInTheDocument();
    expect(within(rajawaliRow!).getByText('Disetujui')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tinjau Garuda Robotika' })).toHaveAttribute(
      'href',
      '/admin/pendaftaran/001',
    );
    expect(api.admin.listRegistrations).toHaveBeenCalledOnce();
  });
});
