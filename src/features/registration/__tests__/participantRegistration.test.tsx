import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PortalRegistrationPage from '../../../pages/portal/PortalRegistrationPage';
import type {
  CompetitionRecord,
  RegistrationApi,
  RegistrationRecord,
  TeamMemberRecord,
} from '../api';

const competition: CompetitionRecord = {
  id: 'competition-1',
  name: 'Ring Rumble — Sumo',
  level: 'Nasional',
};

function registration(overrides: Partial<RegistrationRecord> = {}): RegistrationRecord {
  return {
    id: 'registration-1',
    registrationNumber: 'JRC14-2026-0001',
    competitionId: competition.id,
    competition: { id: competition.id, name: competition.name },
    teamName: 'Garuda Robotika',
    institution: 'PENS',
    phone: '081234567890',
    status: 'DRAFT',
    members: [],
    documents: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

function createApi(overrides: Partial<RegistrationApi['registrations']> = {}): RegistrationApi {
  const created = registration({ teamName: 'Nova', institution: 'ITS', phone: '081234567890' });
  let memberNumber = 0;

  return {
    competitions: {
      list: vi.fn().mockResolvedValue([competition]),
    },
    registrations: {
      list: vi.fn(),
      get: vi.fn().mockResolvedValue(registration()),
      create: vi.fn().mockResolvedValue(created),
      update: vi.fn().mockResolvedValue(created),
      updateMember: vi.fn().mockImplementation(async (_registrationId, memberId, input) => ({
        id: memberId,
        ...input,
      } satisfies TeamMemberRecord)),
      addMember: vi.fn().mockImplementation(async (_registrationId, input) => ({
        id: `member-${++memberNumber}`,
        ...input,
      } satisfies TeamMemberRecord)),
      removeMember: vi.fn().mockResolvedValue(undefined),
      submit: vi.fn().mockResolvedValue(registration({ status: 'SUBMITTED' })),
      invoice: vi.fn(),
      ticket: vi.fn(),
      uploadDocument: vi.fn(),
      ...overrides,
    },
  } as unknown as RegistrationApi;
}

function renderPage(api: RegistrationApi, entry = '/portal/pendaftaran/baru') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/portal" element={<h1>Portal peserta</h1>} />
        <Route path="/portal/pendaftaran" element={<PortalRegistrationPage api={api} />} />
        <Route path="/portal/pendaftaran/:registrationId" element={<PortalRegistrationPage api={api} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PortalRegistrationPage', () => {
  it('creates the registration before adding leader and dynamic members with backend-supported fields', async () => {
    const user = userEvent.setup();
    const api = createApi();
    renderPage(api);

    expect(await screen.findByRole('option', { name: 'Nasional · Ring Rumble — Sumo' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nama tim'), 'Nova');
    await user.type(screen.getByLabelText('Institusi'), 'ITS');
    await user.type(screen.getByLabelText('Nomor WhatsApp tim'), '081234567890');
    await user.selectOptions(screen.getByLabelText('Kompetisi'), competition.id);
    await user.type(screen.getByLabelText('Nama ketua'), 'Ari Wijaya');
    await user.type(screen.getByLabelText('NIS/NIM ketua'), '5025211001');
    await user.click(screen.getByRole('button', { name: 'Tambah anggota' }));
    await user.type(screen.getByLabelText('Nama anggota 1'), 'Bima Putra');
    await user.type(screen.getByLabelText('NIS/NIM anggota 1'), '5025211002');
    await user.click(screen.getByRole('button', { name: 'Simpan draft' }));

    await waitFor(() => expect(api.registrations.create).toHaveBeenCalledWith({
      competitionId: competition.id,
      teamName: 'Nova',
      institution: 'ITS',
      phone: '081234567890',
    }));
    expect(api.registrations.addMember).toHaveBeenNthCalledWith(1, 'registration-1', {
      name: 'Ari Wijaya',
      studentId: '5025211001',
    });
    expect(api.registrations.addMember).toHaveBeenNthCalledWith(2, 'registration-1', {
      name: 'Bima Putra',
      studentId: '5025211002',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Pendaftaran tersimpan.');
  });

  it('uploads a categorized document then refreshes and displays safe metadata', async () => {
    const user = userEvent.setup();
    const leader: TeamMemberRecord = {
      id: 'leader-1',
      name: 'Ari Wijaya',
      studentId: '5025211001',
      role: 'LEADER',
    };
    const document = {
      id: 'document-1',
      category: 'STUDENT_CARD',
      originalName: 'kartu-mahasiswa.pdf',
      mimeType: 'application/pdf',
      size: 2_048,
      createdAt: '2026-09-03T00:00:00.000Z',
    };
    const get = vi.fn()
      .mockResolvedValueOnce(registration({ members: [leader] }))
      .mockResolvedValueOnce(registration({ members: [leader], documents: [document] }));
    const uploadDocument = vi.fn().mockResolvedValue(document);
    const api = createApi({ get, uploadDocument });
    renderPage(api, '/portal/pendaftaran/registration-1');

    await screen.findByDisplayValue('Garuda Robotika');
    await user.selectOptions(screen.getByLabelText('Kategori dokumen'), 'STUDENT_CARD');
    const file = new File(['%PDF-test'], 'kartu-mahasiswa.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Berkas dokumen'), file);
    await user.click(screen.getByRole('button', { name: 'Unggah dokumen' }));

    await waitFor(() => expect(uploadDocument).toHaveBeenCalledTimes(1));
    const formData = uploadDocument.mock.calls[0][1] as FormData;
    expect(uploadDocument).toHaveBeenCalledWith('registration-1', expect.any(FormData));
    expect(formData.get('category')).toBe('STUDENT_CARD');
    expect(formData.get('file')).toBe(file);
    expect(get).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('kartu-mahasiswa.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF · 2 KB')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /kartu-mahasiswa/i })).not.toBeInTheDocument();
  });

  it('persists edits to existing leader and member fields', async () => {
    const user = userEvent.setup();
    const leader: TeamMemberRecord = {
      id: 'leader-1',
      name: 'Ari Wijaya',
      studentId: '5025211001',
      email: 'ari@example.test',
      phone: '+62 812 1111 1111',
      role: 'LEADER',
    };
    const member: TeamMemberRecord = {
      id: 'member-1',
      name: 'Bima Putra',
      studentId: '5025211002',
      email: 'bima@example.test',
      phone: '+62 812 2222 2222',
      role: 'MEMBER',
    };
    const api = createApi({
      get: vi.fn().mockResolvedValue(registration({ members: [leader, member] })),
    });
    renderPage(api, '/portal/pendaftaran/registration-1');

    const leaderName = await screen.findByLabelText('Nama ketua');
    await user.clear(leaderName);
    await user.type(leaderName, 'Ari Baru');
    const memberEmail = screen.getByLabelText('Email anggota 1');
    await user.clear(memberEmail);
    await user.type(memberEmail, 'bima.baru@example.test');
    await user.click(screen.getByRole('button', { name: 'Simpan draft' }));

    await waitFor(() => expect(api.registrations.updateMember).toHaveBeenCalledTimes(2));
    expect(api.registrations.updateMember).toHaveBeenNthCalledWith(1, 'registration-1', 'leader-1', {
      name: 'Ari Baru',
      studentId: '5025211001',
      email: 'ari@example.test',
      phone: '+62 812 1111 1111',
    });
    expect(api.registrations.updateMember).toHaveBeenNthCalledWith(2, 'registration-1', 'member-1', {
      name: 'Bima Putra',
      studentId: '5025211002',
      email: 'bima.baru@example.test',
      phone: '+62 812 2222 2222',
    });
  });

  it('removes a persisted non-leader only after the API succeeds', async () => {
    const user = userEvent.setup();
    const leader: TeamMemberRecord = {
      id: 'leader-1',
      name: 'Ari Wijaya',
      studentId: '5025211001',
      role: 'LEADER',
    };
    const member: TeamMemberRecord = {
      id: 'member-1',
      name: 'Bima Putra',
      studentId: '5025211002',
      role: 'MEMBER',
    };
    let resolveRemoval: (() => void) | undefined;
    const removeMember = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveRemoval = resolve;
    }));
    const api = createApi({
      get: vi.fn().mockResolvedValue(registration({ members: [leader, member] })),
      removeMember,
    });
    renderPage(api, '/portal/pendaftaran/registration-1');

    const removeButton = await screen.findByRole('button', { name: 'Hapus anggota 1' });
    await user.click(removeButton);

    expect(removeMember).toHaveBeenCalledWith('registration-1', 'member-1');
    expect(screen.getByDisplayValue('Bima Putra')).toBeInTheDocument();
    expect(removeButton).toBeDisabled();
    expect(removeButton).toHaveTextContent('Menghapus…');

    resolveRemoval?.();
    await waitFor(() => expect(screen.queryByDisplayValue('Bima Putra')).not.toBeInTheDocument());
  });

  it('keeps a persisted member visible and reports an error when removal fails', async () => {
    const user = userEvent.setup();
    const api = createApi({
      get: vi.fn().mockResolvedValue(registration({
        members: [
          { id: 'leader-1', name: 'Ari Wijaya', studentId: '5025211001', role: 'LEADER' },
          { id: 'member-1', name: 'Bima Putra', studentId: '5025211002', role: 'MEMBER' },
        ],
      })),
      removeMember: vi.fn().mockRejectedValue(new Error('network error')),
    });
    renderPage(api, '/portal/pendaftaran/registration-1');

    await user.click(await screen.findByRole('button', { name: 'Hapus anggota 1' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Anggota gagal dihapus. Silakan coba lagi.',
    );
    expect(screen.getByDisplayValue('Bima Putra')).toBeInTheDocument();
  });
});
