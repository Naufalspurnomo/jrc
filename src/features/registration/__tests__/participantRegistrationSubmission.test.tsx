import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PortalRegistrationPage from '../../../pages/portal/PortalRegistrationPage';
import type {
  CompetitionRecord,
  RegistrationApi,
  RegistrationRecord,
  RegistrationState,
} from '../api';

const competition: CompetitionRecord = {
  id: 'competition-1',
  name: 'Ring Rumble — Sumo',
  level: 'Nasional',
};

function registration(status: RegistrationState, overrides: Partial<RegistrationRecord> = {}): RegistrationRecord {
  return {
    id: 'registration-1',
    registrationNumber: 'JRC14-2026-0001',
    competitionId: competition.id,
    teamName: 'Garuda Robotika',
    institution: 'PENS',
    phone: '081234567890',
    status,
    members: [{ id: 'leader-1', name: 'Ari Wijaya', studentId: '5025211001', role: 'LEADER' }],
    documents: [{
      id: 'document-1',
      category: 'STUDENT_CARD',
      originalName: 'kartu-mahasiswa.pdf',
      mimeType: 'application/pdf',
      size: 2_048,
    }],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

function createApi(record: RegistrationRecord): RegistrationApi {
  return {
    competitions: { list: vi.fn().mockResolvedValue([competition]) },
    registrations: {
      list: vi.fn(),
      get: vi.fn().mockResolvedValue(record),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(record),
      addMember: vi.fn(),
      removeMember: vi.fn(),
      submit: vi.fn().mockResolvedValue(registration('SUBMITTED')),
      invoice: vi.fn(),
      ticket: vi.fn(),
      uploadDocument: vi.fn(),
    },
  } as unknown as RegistrationApi;
}

function renderPage(api: RegistrationApi) {
  return render(
    <MemoryRouter initialEntries={['/portal/pendaftaran/registration-1']}>
      <Routes>
        <Route path="/portal" element={<h1>Portal peserta</h1>} />
        <Route
          path="/portal/pendaftaran/:registrationId"
          element={<PortalRegistrationPage api={api} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PortalRegistrationPage submission', () => {
  it('submits a saved registration with members and documents then returns to the portal', async () => {
    const user = userEvent.setup();
    const api = createApi(registration('DRAFT'));
    renderPage(api);

    await screen.findByDisplayValue('Garuda Robotika');
    await user.click(screen.getByRole('button', { name: 'Kirim pendaftaran' }));

    await waitFor(() => expect(api.registrations.submit).toHaveBeenCalledWith('registration-1'));
    expect(await screen.findByRole('heading', { name: 'Portal peserta' })).toBeInTheDocument();
  });

  it('keeps submission unavailable until a document exists and never duplicates loaded members on save', async () => {
    const user = userEvent.setup();
    const api = createApi(registration('DRAFT', { documents: [] }));
    renderPage(api);

    await screen.findByDisplayValue('Garuda Robotika');
    expect(screen.getByRole('button', { name: 'Kirim pendaftaran' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Simpan draft' }));

    await waitFor(() => expect(api.registrations.update).toHaveBeenCalledTimes(1));
    expect(api.registrations.addMember).not.toHaveBeenCalled();
    expect(api.registrations.submit).not.toHaveBeenCalled();
  });

  it('shows review feedback but makes submitted registrations read-only', async () => {
    const api = createApi(registration('SUBMITTED', { reviewReason: 'Foto kartu identitas kurang jelas.' }));
    renderPage(api);

    const teamName = await screen.findByLabelText('Nama tim');
    expect(teamName).toBeDisabled();
    expect(screen.getByText('Foto kartu identitas kurang jelas.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simpan draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unggah dokumen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kirim pendaftaran' })).not.toBeInTheDocument();
  });

  it('allows a registration requiring revision to be edited', async () => {
    const api = createApi(registration('REVISION_REQUESTED', {
      reviewReason: 'Unggah ulang dokumen peserta.',
    }));
    renderPage(api);

    expect(await screen.findByLabelText('Nama tim')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Simpan draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unggah dokumen' })).toBeInTheDocument();
    expect(screen.getByText('Unggah ulang dokumen peserta.')).toBeInTheDocument();
  });
});
