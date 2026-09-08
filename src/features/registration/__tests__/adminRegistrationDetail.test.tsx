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

function createApi(registration: AdminRegistrationFixture): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue(adminSession),
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
});