import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import AdminPaidTeamsPage from '../../../pages/admin/AdminPaidTeamsPage';
import type { AuthSession, PaidTeamListResult, PaidTeamRecord, RegistrationApi } from '../api';

const viewerSession: AuthSession = {
  user: {
    id: 'viewer-1',
    displayName: 'Divisi Acara',
    email: 'acara@example.test',
    role: 'PAID_TEAM_VIEWER',
  },
};

const paidTeam: PaidTeamRecord = {
  registrationNumber: 'JRC-XIV-0015',
  teamName: 'Garuda Robotika',
  institution: 'PENS',
  competition: {
    id: 'competition-1',
    name: 'Charion Line',
    level: 'Umum',
    discipline: 'Line Follower Mikro',
  },
  verifiedAt: '2026-10-05T08:30:00.000Z',
};

function pageResult(
  items: PaidTeamRecord[] = [paidTeam],
  hasNextPage = false,
): PaidTeamListResult {
  return { items, page: 1, pageSize: 50, hasNextPage };
}

function createApi(result: PaidTeamListResult = pageResult()): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue(viewerSession),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    },
    admin: {
      listPaidTeams: vi.fn().mockResolvedValue(result),
    },
  } as unknown as RegistrationApi;
}

function renderPage(api: RegistrationApi) {
  return render(
    <MemoryRouter>
      <AuthProvider api={api}>
        <AdminPaidTeamsPage api={api} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminPaidTeamsPage', () => {
  it('shows only the minimal read-only paid-team data', async () => {
    const unsafe = {
      ...paidTeam,
      owner: { email: 'secret@example.test' },
      phone: '+628123456789',
      proofStorageKey: 'hidden-proof',
    } as PaidTeamRecord;
    const api = createApi(pageResult([unsafe]));
    renderPage(api);

    const row = await screen.findByRole('row', { name: /Garuda Robotika/ });
    expect(within(row).getByText('JRC-XIV-0015')).toBeInTheDocument();
    expect(within(row).getByText('PENS')).toBeInTheDocument();
    expect(within(row).getByText('Charion Line')).toBeInTheDocument();
    expect(screen.queryByText('secret@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('+628123456789')).not.toBeInTheDocument();
    expect(screen.queryByText('hidden-proof')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ubah|hapus|setujui|tolak/i })).not.toBeInTheDocument();
  });

  it('searches on the server and offers retry after a load failure', async () => {
    const api = createApi(pageResult([]));
    vi.mocked(api.admin.listPaidTeams)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(pageResult([]))
      .mockResolvedValueOnce(pageResult([]));
    const user = userEvent.setup();
    renderPage(api);

    expect(await screen.findByRole('alert')).toHaveTextContent('Daftar tim lunas gagal dimuat');
    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Belum ada tim dengan pembayaran terverifikasi.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Cari tim'), 'Garuda');
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    expect(api.admin.listPaidTeams).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'Garuda' }));
  });

  it('uses explicit pagination metadata at the exact page-size boundary', async () => {
    const boundary = Array.from({ length: 50 }, (_, index) => ({
      ...paidTeam,
      registrationNumber: `JRC-XIV-${String(index + 1).padStart(4, '0')}`,
    }));
    const api = createApi(pageResult(boundary, false));
    renderPage(api);

    expect(await screen.findAllByRole('row')).toHaveLength(51);
    expect(screen.getByRole('button', { name: 'Berikutnya' })).toBeDisabled();
  });
});