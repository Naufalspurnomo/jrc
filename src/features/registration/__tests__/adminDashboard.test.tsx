import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import { ToastProvider } from '../../../components/feedback/ToastProvider';
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
    competition: { id: 'competition-1', name: 'Colosseum Clash' },
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
      googleSheetsStatus: vi.fn().mockResolvedValue({
        enabled: true,
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
        syncing: false,
        lastSyncedAt: '2026-11-16T04:00:00.000Z',
        lastError: null,
      }),
      syncGoogleSheets: vi.fn().mockResolvedValue({
        enabled: true,
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
        syncing: false,
        lastSyncedAt: '2026-11-16T04:01:00.000Z',
        lastError: null,
        registrationCount: registrations.length,
        attendanceCount: 0,
      }),
    },
  } as unknown as RegistrationApi;
}

function renderDashboard(api: RegistrationApi) {
  return render(
    <MemoryRouter>
      <AuthProvider api={api}>
        <ToastProvider><AdminDashboardPage api={api} /></ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminDashboardPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the live spreadsheet and supports a manual synchronization', async () => {
    const api = createApi([registration('001', 'Garuda Robotika', 'SUBMITTED')]);

    renderDashboard(api);
    await screen.findByText('Garuda Robotika');
    expect(await screen.findByRole('link', { name: 'Buka Spreadsheet' })).toHaveAttribute(
      'href',
      'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sinkronkan sekarang' }));
    expect(api.admin.syncGoogleSheets).toHaveBeenCalledOnce();
    expect(await screen.findByText('Spreadsheet berhasil disinkronkan.')).toBeInTheDocument();
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

  it('requires exact typed confirmation before a super admin can delete an eligible record', async () => {
    const api = createApi([registration('001', 'Garuda Robotika', 'DRAFT')]);
    (api.auth.me as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { ...adminSession.user, role: 'SUPER_ADMIN' },
    });
    api.admin.deleteRegistration = vi.fn().mockResolvedValue({ deleted: true, cleanupWarnings: [] });
    renderDashboard(api);

    const row = (await screen.findByText('Garuda Robotika')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Hapus' }));
    const confirm = screen.getByRole('button', { name: 'Hapus permanen' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), 'JRC-001');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);

    expect(api.admin.deleteRegistration).toHaveBeenCalledWith('001');
    expect(await screen.findByText('Pendaftaran berhasil dihapus.')).toBeInTheDocument();
    expect(screen.queryByText('Garuda Robotika')).not.toBeInTheDocument();
  });

  it('never offers deletion to reviewers or for approved records', async () => {
    const reviewerApi = createApi([registration('001', 'Reviewer Team', 'DRAFT')]);
    const reviewer = renderDashboard(reviewerApi);
    await screen.findByText('Reviewer Team');
    expect(screen.queryByRole('button', { name: 'Hapus' })).not.toBeInTheDocument();
    reviewer.unmount();

    const adminApi = createApi([registration('002', 'Protected Team', 'APPROVED')]);
    (adminApi.auth.me as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { ...adminSession.user, role: 'SUPER_ADMIN' },
    });
    renderDashboard(adminApi);
    await screen.findByText('Protected Team');
    expect(screen.queryByRole('button', { name: 'Hapus' })).not.toBeInTheDocument();
  });
});
