import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import PortalRegistrationPage from '../../../pages/portal/PortalRegistrationPage';
import type {
  CompetitionRecord,
  RegistrationApi,
  RegistrationRecord,
  RegistrationState,
} from '../api';

const competition: CompetitionRecord = {
  id: 'competition-1',
  name: 'Colosseum Clash',
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
    members: [
      { id: 'leader-1', name: 'Ari Wijaya', studentId: '5025211001', role: 'LEADER' },
      { id: 'supervisor-1', name: 'Rina Pembina', role: 'SUPERVISOR' },
    ],
    documents: [
      ...[
        'RECOMMENDATION_LETTER',
        'IDENTITY_CARD',
        'REGISTRATION_FORM',
        'TEAM_PHOTO',
        'TWIBBON_PROOF',
      ].map((category, index) => ({
        id: `document-${index + 1}`,
        category,
        originalName: `${category.toLowerCase()}.pdf`,
        mimeType: 'application/pdf',
        size: 2_048,
      })),
      {
        id: 'leader-photo',
        category: 'MEMBER_PHOTO',
        originalName: 'ari-wijaya.jpg',
        mimeType: 'image/jpeg',
        size: 2_048,
        subjectName: 'Ari Wijaya',
        subjectRole: 'PARTICIPANT',
      },
      {
        id: 'supervisor-photo',
        category: 'MEMBER_PHOTO',
        originalName: 'rina-pembina.jpg',
        mimeType: 'image/jpeg',
        size: 2_048,
        subjectName: 'Rina Pembina',
        subjectRole: 'SUPERVISOR',
      },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

function createApi(record: RegistrationRecord): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'ari@example.test',
          displayName: 'Ari Wijaya',
          role: 'PARTICIPANT',
          emailVerified: true,
        },
      }),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      verifyEmail: vi.fn(),
      resendEmailVerification: vi.fn(),
    },
    competitions: { list: vi.fn().mockResolvedValue([competition]) },
    registrations: {
      list: vi.fn(),
      get: vi.fn().mockResolvedValue(record),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(record),
      addMember: vi.fn(),
      updateMember: vi.fn().mockResolvedValue(undefined),
      removeMember: vi.fn(),
      removeDocument: vi.fn(),
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
      <AuthProvider api={api}>
        <Routes>
          <Route path="/portal" element={<h1>Portal peserta</h1>} />
          <Route
            path="/portal/pendaftaran/:registrationId"
            element={<PortalRegistrationPage api={api} />}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('PortalRegistrationPage submission', () => {
  it('submits a saved registration with members and documents then returns to the portal', async () => {
    const user = userEvent.setup();
    const api = createApi(registration('DRAFT'));
    renderPage(api);

    await screen.findByDisplayValue('Garuda Robotika');
    await waitFor(() => expect(api.auth.me).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Kirim pendaftaran' }));

    await waitFor(() => expect(api.registrations.submit).toHaveBeenCalledWith('registration-1'));
    expect(await screen.findByRole('heading', { name: 'Portal peserta' })).toBeInTheDocument();
  });

  it('keeps submission unavailable until a document exists and never duplicates loaded members on save', async () => {
    const user = userEvent.setup();
    const api = createApi(registration('DRAFT', { documents: [] }));
    renderPage(api);

    await screen.findByDisplayValue('Garuda Robotika');

    // The submit button stays clickable and explains what is missing instead of
    // sitting disabled with no reason.
    const submit = screen.getByRole('button', { name: 'Kirim pendaftaran' });
    expect(submit).toBeEnabled();
    await user.click(submit);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveFocus();
    expect(alert).toHaveAccessibleName('Pendaftaran belum dapat dikirim');
    expect(alert).not.toHaveTextContent('Surat rekomendasi');
    expect(alert).toHaveTextContent('Identitas diri (kartu pelajar/KTM/KTP)');
    expect(alert).toHaveTextContent('Formulir pendaftaran');
    expect(alert).toHaveTextContent('Foto tim');
    expect(alert).toHaveTextContent('Bukti twibbon');
    expect(screen.getByRole('button', { name: 'Lengkapi dokumen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Berkas dokumen')).toHaveAttribute('aria-invalid', 'true');
    expect(api.registrations.submit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Simpan sekarang' }));
    expect(api.registrations.addMember).not.toHaveBeenCalled();
    expect(api.registrations.submit).not.toHaveBeenCalled();
  });

  it('accepts a selected file of exactly 5 MiB', async () => {
    const user = userEvent.setup();
    const api = createApi(registration('DRAFT'));
    renderPage(api);

    const input = await screen.findByLabelText('Berkas dokumen');
    const file = new File(['x'], 'exact-limit.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 });
    await user.upload(input, file);

    expect(screen.queryByRole('alert', { name: 'Berkas terlalu besar' })).not.toBeInTheDocument();
    expect(screen.getByText('5.0 MB · siap diunggah')).toBeInTheDocument();
  });

  it('rejects a selected file of 5 MiB plus one byte with the exact limit and remedy', async () => {
    const user = userEvent.setup();
    const api = createApi(registration('DRAFT'));
    renderPage(api);

    const input = await screen.findByLabelText('Berkas dokumen');
    const file = new File(['x'], 'IMG_6568.jpg.jpeg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
    await user.upload(input, file);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveFocus();
    expect(alert).toHaveAccessibleName('Berkas terlalu besar');
    expect(alert).toHaveTextContent('IMG_6568.jpg.jpeg');
    expect(alert).toHaveTextContent('5.0 MB');
    expect(alert).toHaveTextContent('Ukuran maksimum 5 MiB (5.242.880 byte)');
    expect(alert).toHaveTextContent('Kompres berkas atau pilih berkas yang lebih kecil');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('5.0 MB · belum dapat diunggah')).toBeInTheDocument();
    expect(api.registrations.uploadDocument).not.toHaveBeenCalled();
  });

  it('shows structured rejection feedback and makes rejected registrations read-only', async () => {
    const api = createApi(registration('REJECTED', {
      reviewReasonCategory: 'DOCUMENT_INVALID',
      reviewReasonComment: 'Foto kartu identitas kurang jelas.',
    }));
    renderPage(api);

    const teamName = await screen.findByLabelText('Nama tim');
    expect(teamName).toBeDisabled();
    expect(screen.getByText('Dokumen tidak valid')).toBeInTheDocument();
    expect(screen.getByText('Foto kartu identitas kurang jelas.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simpan draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unggah dokumen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kirim pendaftaran' })).not.toBeInTheDocument();
  });

  it('allows a registration requiring revision to be edited', async () => {
    const api = createApi(registration('REVISION_REQUESTED', {
      reviewReasonCategory: 'DOCUMENT_INCOMPLETE',
      reviewReasonComment: 'Unggah ulang dokumen peserta.',
    }));
    renderPage(api);

    expect(await screen.findByLabelText('Nama tim')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Simpan sekarang' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unggah dokumen' })).toBeInTheDocument();
    expect(screen.getByText('Dokumen belum lengkap')).toBeInTheDocument();
    expect(screen.getByText('Unggah ulang dokumen peserta.')).toBeInTheDocument();
  });
});
