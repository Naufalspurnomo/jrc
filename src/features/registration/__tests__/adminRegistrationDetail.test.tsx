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
    emailVerified: true,
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
      name: 'Ring Rumble — Sumo',
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
        role: 'LEADER',
        name: 'Budi Ketua',
        studentId: 'NRP-001',
      },
    ],
    documents: [
      {
        id: 'document-1',
        category: 'STUDENT_CARD',
        originalName: 'kartu-mahasiswa.pdf',
        mimeType: 'application/pdf',
        size: 2_048,
        active: true,
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
      editRegistration: vi.fn().mockResolvedValue(registration),
      replaceRegistrationDocument: vi.fn().mockResolvedValue(registration.documents?.[0]),
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
    expect(screen.getByText('Ring Rumble — Sumo')).toBeInTheDocument();
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

  it('links and focuses the review reason validation error without invalidating network failures', async () => {
    const api = createApi(detail('UNDER_REVIEW'));
    const user = userEvent.setup();
    renderDetail(api);

    const reason = await screen.findByLabelText('Catatan alasan');
    expect(reason).toHaveAttribute('aria-describedby', 'admin-review-reason-help');
    expect(reason).not.toHaveAttribute('aria-invalid');
    await user.click(screen.getByRole('button', { name: 'Minta revisi' }));

    expect(screen.getByRole('alert')).toHaveAttribute('id', 'admin-review-reason-error');
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(reason).toHaveAttribute('aria-describedby', 'admin-review-reason-help admin-review-reason-error');
    expect(reason).toHaveFocus();

    vi.mocked(api.admin.reviewRegistration).mockRejectedValueOnce(new Error('offline'));
    await user.selectOptions(screen.getByLabelText('Kategori alasan'), 'DOCUMENT_INVALID');
    await user.type(reason, 'Dokumen identitas tidak terbaca');
    await user.click(screen.getByRole('button', { name: 'Minta revisi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Keputusan gagal disimpan');
    expect(reason).not.toHaveAttribute('aria-invalid');
    expect(reason).toHaveAttribute('aria-describedby', 'admin-review-reason-help admin-review-reason-error');
  });

  it('uploads a replacement document while keeping the registration approved and paid', async () => {
    const paidInvoice: InvoiceRecord = {
      id: 'invoice-1',
      invoiceNumber: 'JRC-INV-2026-1',
      amount: 100000,
      currency: 'IDR',
      provider: 'MANUAL',
      instructions: {},
      paymentStatus: 'PAID',
      deadline: '2026-11-30T00:00:00.000Z',
      verificationReason: null,
      verifiedAt: '2026-11-24T00:00:00.000Z',
    };
    const original = detail('APPROVED', paidInvoice);
    const updated = detail('APPROVED', paidInvoice);
    const originalDocuments = original.documents ?? [];
    updated.documents = [
      ...originalDocuments,
      { ...originalDocuments[0], id: 'document-3', originalName: 'kartu-baru.pdf', active: true },
    ];
    updated.invoice = original.invoice;
    const api = createApi(original);
    vi.mocked(api.admin.replaceRegistrationDocument).mockResolvedValue(updated.documents?.[1] as NonNullable<RegistrationRecord['documents']>[number]);
    vi.mocked(api.admin.getRegistration).mockResolvedValue(updated);
    const user = userEvent.setup();
    renderDetail(api);

    await screen.findByRole('heading', { name: 'Garuda Robotika' });
    const replaceInput = screen.getAllByLabelText('Ganti dokumen')[0] as HTMLInputElement;
    const file = new File(['%PDF-correct'], 'kartu-baru.pdf', { type: 'application/pdf' });
    await user.upload(replaceInput, file);

    await waitFor(() => expect(api.admin.replaceRegistrationDocument).toHaveBeenCalledWith(
      'registration-1',
      'document-1',
      expect.any(FormData),
    ));
    expect(await screen.findByText('Aktif')).toBeInTheDocument();
    expect(screen.getByText('Lunas')).toBeInTheDocument();
  });

  it('edits participant data without changing the review panel workflow', async () => {
    const original = detail('APPROVED');
    const edited = detail('APPROVED');
    edited.teamName = 'Garuda Robotika Baru';
    const api = createApi(original);
    vi.mocked(api.admin.editRegistration).mockResolvedValue(edited);
    const user = userEvent.setup();
    renderDetail(api);

    await user.click(await screen.findByRole('button', { name: 'Koreksi data peserta' }));
    const teamName = screen.getByLabelText('Nama tim');
    await user.clear(teamName);
    await user.type(teamName, 'Garuda Robotika Baru');
    await user.click(screen.getByRole('button', { name: 'Simpan koreksi' }));

    expect(api.admin.editRegistration).toHaveBeenCalledWith('registration-1', {
      ownerDisplayName: 'Ayu Peserta',
      ownerEmail: 'ayu@example.test',
      teamName: 'Garuda Robotika Baru',
      institution: 'PENS',
      phone: '081234567890',
      members: [{ id: 'member-1', role: 'LEADER', name: 'Budi Ketua', studentId: 'NRP-001', email: '', phone: '' }],
    });
    expect(await screen.findByRole('heading', { name: 'Garuda Robotika Baru' })).toBeInTheDocument();
    expect(screen.getByText('Aktif')).toBeInTheDocument();
  });
});
