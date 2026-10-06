import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import { ToastProvider } from '../../../components/feedback/ToastProvider';
import AdminParticipantsPage from '../../../pages/admin/AdminParticipantsPage';
import type { AdminParticipantRecord, RegistrationApi } from '../api';

const clearParticipant: AdminParticipantRecord = {
  id: 'participant-1',
  displayName: 'Ari Wijaya',
  email: 'ari@example.test',
  active: true,
  emailVerified: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  sessionCount: 2,
  registration: null,
  deletionBlocked: false,
};

const protectedParticipant: AdminParticipantRecord = {
  ...clearParticipant,
  id: 'participant-2',
  displayName: 'Bima Robotika',
  email: 'bima@example.test',
  registration: {
    id: 'registration-1',
    registrationNumber: 'JRC-XIV-0001',
    teamName: 'Bima Team',
    status: 'APPROVED',
    paymentStatus: 'PAID',
    ticketStatus: 'ACTIVE',
    updatedAt: '2026-09-03T00:00:00.000Z',
  },
  deletionBlocked: true,
};

function createApi(): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue({
        user: {
          id: 'admin-1',
          displayName: 'Super Admin',
          email: 'admin@example.test',
          role: 'SUPER_ADMIN',
          emailVerified: true,
        },
      }),
      logout: vi.fn(),
    },
    admin: {
      listParticipants: vi.fn().mockResolvedValue([clearParticipant, protectedParticipant]),
      deleteParticipant: vi.fn().mockResolvedValue({ deleted: true }),
    },
  } as unknown as RegistrationApi;
}

function renderPage(api: RegistrationApi) {
  return render(
    <MemoryRouter>
      <AuthProvider api={api}>
        <ToastProvider><AdminParticipantsPage api={api} /></ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminParticipantsPage', () => {
  it('shows activity and only permits deletion for activity-free accounts', async () => {
    const api = createApi();
    renderPage(api);

    const clearRow = (await screen.findByText('Ari Wijaya')).closest('tr')!;
    const protectedRow = screen.getByText('Bima Robotika').closest('tr')!;
    expect(within(clearRow).getByRole('button', { name: 'Hapus akun Ari Wijaya' })).toBeEnabled();
    expect(within(protectedRow).queryByRole('button')).not.toBeInTheDocument();
    expect(within(protectedRow).getByText(/JRC-XIV-0001/)).toBeInTheDocument();
    expect(within(protectedRow).getByText(/Pembayaran: PAID/)).toBeInTheDocument();
  });

  it('requires exact email confirmation and removes a deleted participant', async () => {
    const api = createApi();
    renderPage(api);

    const row = (await screen.findByText('Ari Wijaya')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Hapus akun Ari Wijaya' }));
    const confirm = screen.getByRole('button', { name: 'Hapus permanen' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), 'ari@example.test');
    await userEvent.click(confirm);

    expect(api.admin.deleteParticipant).toHaveBeenCalledWith('participant-1');
    expect(await screen.findByText('Akun peserta berhasil dihapus.')).toBeInTheDocument();
    expect(screen.queryByText('Ari Wijaya')).not.toBeInTheDocument();
  });

  it('searches the server instead of filtering only the loaded page', async () => {
    const api = createApi();
    vi.mocked(api.admin.listParticipants)
      .mockResolvedValueOnce([clearParticipant])
      .mockResolvedValueOnce([protectedParticipant]);
    renderPage(api);

    await screen.findByText('Ari Wijaya');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Pencarian' }), 'bima');

    await waitFor(() => expect(api.admin.listParticipants).toHaveBeenLastCalledWith({
      query: 'bima', page: 1, pageSize: 25,
    }));
    expect(await screen.findByText('Bima Robotika')).toBeInTheDocument();
  });

  it('requests the next participant page from the server', async () => {
    const api = createApi();
    const firstPage = Array.from({ length: 25 }, (_, index) => ({
      ...clearParticipant,
      id: `participant-${index}`,
      displayName: `Peserta ${index}`,
      email: `peserta-${index}@example.test`,
    }));
    vi.mocked(api.admin.listParticipants)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([protectedParticipant]);
    renderPage(api);

    await screen.findByText('Peserta 0');
    await userEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));

    await waitFor(() => expect(api.admin.listParticipants).toHaveBeenLastCalledWith({
      query: undefined, page: 2, pageSize: 25,
    }));
    expect(await screen.findByText('Bima Robotika')).toBeInTheDocument();
  });
});
