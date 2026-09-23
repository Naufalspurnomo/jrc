import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import AdminRegistrationDetailPage from '../../../pages/admin/AdminRegistrationDetailPage';
import type {
  AuthSession,
  InvoiceRecord,
  RegistrationApi,
  RegistrationRecord,
} from '../api';

const adminSession: AuthSession = {
  user: {
    id: 'reviewer-1',
    displayName: 'Rina Reviewer',
    email: 'rina@example.test',
    role: 'REGISTRATION_REVIEWER',
  },
};

type AdminRegistrationFixture = RegistrationRecord & {
  owner: {
    id: string;
    displayName: string;
    email: string;
  };
  invoice: InvoiceRecord | null;
};

function detail(
  status: RegistrationRecord['status'],
  invoice: InvoiceRecord | null = null,
): AdminRegistrationFixture {
  return {
    id: 'registration-1',
    registrationNumber: 'JRC14-2026-0001',
    competitionId: 'competition-1',
    competition: {
      id: 'competition-1',
      name: 'Colosseum Clash — Sumo',
      eventId: 'jrc-xiv',
      eventName: 'JRC XIV',
    },
    owner: {
      id: 'participant-1',
      displayName: 'Ayu Peserta',
      email: 'ayu@example.test',
    },
    teamName: 'Garuda Robotika',
    institution: 'PENS',
    phone: '081234567890',
    members: [
      {
        id: 'member-1',
        name: 'Budi Ketua',
        studentId: 'NRP-001',
        role: 'LEADER',
      },
    ],
    documents: [
      {
        id: 'document-1',
        category: 'STUDENT_CARD',
        originalName: 'kartu-mahasiswa.pdf',
        mimeType: 'application/pdf',
        size: 2_048,
        downloadUrl: '/api/admin/documents/document-1/download',
      },
      {
        id: 'document-2',
        category: 'TEAM_PHOTO',
        originalName: 'foto-tim.png',
        mimeType: 'image/png',
        size: 4_096,
      },
    ],
    status,
    paymentStatus: invoice?.paymentStatus ?? 'NOT_CREATED',
    invoice,
    ticketStatus: 'ACTIVE',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };
}

function createApi(registration: AdminRegistrationFixture, session = adminSession): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue(session),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    },
    admin: {
      getRegistration: vi.fn().mockResolvedValue(registration),
      reviewRegistration: vi.fn(),
    },
  } as unknown as RegistrationApi;
}

function renderDetail(api: RegistrationApi) {
  return render(
    <MemoryRouter initialEntries={['/admin/pendaftaran/registration-1']}>
      <AuthProvider api={api}>
        <Routes>
          <Route
            path="/admin/pendaftaran/:registrationId"
            element={<AdminRegistrationDetailPage api={api} />}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminRegistrationDetailPage', () => {
  it('loads and renders the API detail with only authorized document links', async () => {
    const api = createApi(detail('APPROVED'));
    renderDetail(api);

    expect(await screen.findByRole('heading', { name: 'Garuda Robotika' })).toBeInTheDocument();
    expect(api.admin.getRegistration).toHaveBeenCalledWith('registration-1');
    expect(screen.getByText('Ayu Peserta')).toBeInTheDocument();
    expect(screen.getByText('ayu@example.test')).toBeInTheDocument();
    expect(screen.getByText('Colosseum Clash — Sumo')).toBeInTheDocument();
    expect(screen.getByText('Budi Ketua')).toBeInTheDocument();
    expect(screen.getByText('NRP-001')).toBeInTheDocument();
    expect(screen.getByText('Aktif')).toBeInTheDocument();

    const linkedDocument = screen.getByText('kartu-mahasiswa.pdf').closest('article');
    const unlinkedDocument = screen.getByText('foto-tim.png').closest('article');
    expect(linkedDocument).not.toBeNull();
    expect(unlinkedDocument).not.toBeNull();
    expect(within(linkedDocument!).getByRole('link', { name: 'Unduh kartu-mahasiswa.pdf' })).toHaveAttribute(
      'href',
      '/api/admin/documents/document-1/download',
    );
    expect(within(unlinkedDocument!).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/metadata lokal|prototype|fixture demo/i)).not.toBeInTheDocument();
  });

  it('moves a submitted registration to review then reloads the server detail', async () => {
    const submitted = detail('SUBMITTED');
    const underReview = detail('UNDER_REVIEW');
    const api = createApi(submitted);
    vi.mocked(api.admin.getRegistration)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(underReview);
    vi.mocked(api.admin.reviewRegistration).mockResolvedValue(underReview);
    const user = userEvent.setup();
    renderDetail(api);

    await user.click(await screen.findByRole('button', { name: 'Mulai review' }));

    expect(api.admin.reviewRegistration).toHaveBeenCalledWith('registration-1', {
      status: 'UNDER_REVIEW',
    });
    await waitFor(() => expect(api.admin.getRegistration).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Dalam review')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mulai review' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setujui' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Minta revisi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tolak' })).toBeInTheDocument();
  });

  it('requires category and comment and sends the exact structured payload', async () => {
    const underReview = detail('UNDER_REVIEW');
    const revised = {
      ...detail('REVISION_REQUESTED'),
      reviewReasonCategory: 'DOCUMENT_INVALID' as const,
      reviewReasonComment: 'Foto kartu identitas tidak terbaca.',
    };
    const api = createApi(underReview);
    vi.mocked(api.admin.getRegistration)
      .mockResolvedValueOnce(underReview)
      .mockResolvedValueOnce(revised);
    vi.mocked(api.admin.reviewRegistration).mockResolvedValue(revised);
    const user = userEvent.setup();
    renderDetail(api);

    await user.click(await screen.findByRole('button', { name: 'Minta revisi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Kategori dan catatan wajib diisi');
    expect(api.admin.reviewRegistration).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText('Kategori alasan'), 'DOCUMENT_INVALID');
    await user.type(screen.getByLabelText('Catatan alasan'), '  Foto kartu identitas tidak terbaca.  ');
    await user.click(screen.getByRole('button', { name: 'Minta revisi' }));

    expect(api.admin.reviewRegistration).toHaveBeenCalledWith('registration-1', {
      status: 'REVISION_REQUESTED',
      reasonCategory: 'DOCUMENT_INVALID',
      reasonComment: 'Foto kartu identitas tidak terbaca.',
    });
    expect(await screen.findByText('Dokumen tidak valid')).toBeInTheDocument();
    expect(screen.getByText(/Catatan alasan:\s*Foto kartu identitas tidak terbaca\./)).toBeInTheDocument();
  });

  it('approves without reason fields', async () => {
    const underReview = detail('UNDER_REVIEW');
    const approved = detail('APPROVED');
    const api = createApi(underReview);
    vi.mocked(api.admin.getRegistration)
      .mockResolvedValueOnce(underReview)
      .mockResolvedValueOnce(approved);
    vi.mocked(api.admin.reviewRegistration).mockResolvedValue(approved);
    const user = userEvent.setup();
    renderDetail(api);

    await user.click(await screen.findByRole('button', { name: 'Setujui' }));
    expect(api.admin.reviewRegistration).toHaveBeenCalledWith('registration-1', { status: 'APPROVED' });
  });

  it('sends the exact structured rejection payload and disables controls while saving', async () => {
    const underReview = detail('UNDER_REVIEW');
    let resolveReview!: (record: RegistrationRecord) => void;
    const pendingReview = new Promise<RegistrationRecord>((resolve) => {
      resolveReview = resolve;
    });
    const api = createApi(underReview);
    vi.mocked(api.admin.reviewRegistration).mockReturnValue(pendingReview);
    const user = userEvent.setup();
    renderDetail(api);

    await screen.findByRole('button', { name: 'Tolak' });
    await user.selectOptions(screen.getByLabelText('Kategori alasan'), 'ELIGIBILITY');
    await user.type(screen.getByLabelText('Catatan alasan'), 'Peserta tidak memenuhi persyaratan.');
    await user.click(screen.getByRole('button', { name: 'Tolak' }));

    expect(api.admin.reviewRegistration).toHaveBeenCalledWith('registration-1', {
      status: 'REJECTED',
      reasonCategory: 'ELIGIBILITY',
      reasonComment: 'Peserta tidak memenuhi persyaratan.',
    });
    expect(screen.getByLabelText('Kategori alasan')).toBeDisabled();
    expect(screen.getByLabelText('Catatan alasan')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Setujui' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Minta revisi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tolak' })).toBeDisabled();

    resolveReview(underReview);
    await waitFor(() => expect(screen.queryByText('Menyimpan keputusan…')).not.toBeInTheDocument());
  });

  it('shows structured feedback without mutation controls to support staff', async () => {
    const record = {
      ...detail('REVISION_REQUESTED'),
      reviewReasonCategory: 'DATA_MISMATCH' as const,
      reviewReasonComment: 'Nama peserta berbeda dengan kartu identitas.',
    };
    const supportSession: AuthSession = {
      user: { ...adminSession.user, id: 'support-1', role: 'SUPPORT' },
    };
    renderDetail(createApi(record, supportSession));

    expect(await screen.findByText('Data tidak sesuai')).toBeInTheDocument();
    expect(screen.getByText(/Catatan alasan:\s*Nama peserta berbeda dengan kartu identitas\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mulai review|setujui|minta revisi|tolak/i })).not.toBeInTheDocument();
  });
});