import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    competition: { id: 'competition-1', name: 'Colosseum — Sumo' },
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
      exportAttendance: vi.fn().mockResolvedValue('registrationNumber,attendance\nJRC-001,HADIR'),
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the canonical attendance CSV from the compact header', async () => {
    const api = createApi([registration('001', 'Garuda Robotika', 'SUBMITTED')]);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:attendance');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    renderDashboard(api);
    await screen.findByText('Garuda Robotika');
    await userEvent.click(screen.getByRole('button', { name: 'Ekspor presensi' }));

    expect(api.admin.exportAttendance).toHaveBeenCalledOnce();
    expect(api.admin.exportRegistrations).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:attendance');
  });

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
