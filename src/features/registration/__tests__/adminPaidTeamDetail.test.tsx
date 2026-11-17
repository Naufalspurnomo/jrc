import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import AdminPaidTeamDetailPage from '../../../pages/admin/AdminPaidTeamDetailPage';
import type {
  AuthSession,
  PaidTeamDetailRecord,
  RegistrationApi,
} from '../api';

const viewerSession: AuthSession = {
  user: {
    id: 'viewer-1',
    displayName: 'Divisi Acara',
    email: 'acara@example.test',
    role: 'PAID_TEAM_VIEWER',
    emailVerified: true,
  },
};

const detail: PaidTeamDetailRecord = {
  id: 'registration-1',
  registrationNumber: 'JRC-XIV-0015',
  teamName: 'Garuda Robotika',
  institution: 'PENS',
  phone: '081234567890',
  status: 'APPROVED',
  submittedAt: '2026-10-01T08:00:00.000Z',
  createdAt: '2026-09-30T08:00:00.000Z',
  updatedAt: '2026-10-05T08:30:00.000Z',
  owner: {
    displayName: 'Ayu Peserta',
    email: 'ayu@example.test',
  },
  competition: {
    id: 'competition-1',
    name: 'Chariot Line',
    level: 'Umum',
    discipline: 'Line Follower Mikro',
    eventName: 'JRC XIV',
  },
  members: [
    {
      id: 'member-1',
      name: 'Budi Ketua',
      studentId: 'NRP-001',
      role: 'LEADER',
      email: 'budi@example.test',
      phone: '081111111111',
      photo: {
        id: 'photo-1',
        originalName: 'budi.jpg',
        mimeType: 'image/jpeg',
        size: 2048,
        viewUrl: '/api/admin/paid-teams/registration-1/photos/photo-1',
        downloadUrl: '/api/admin/paid-teams/registration-1/photos/photo-1?download=true',
      },
    },
    {
      id: 'member-2',
      name: 'Rina Pembina',
      studentId: null,
      role: 'SUPERVISOR',
      email: null,
      phone: null,
      photo: null,
    },
  ],
  payment: {
    invoiceNumber: 'INV-JRC-XIV-0015',
    amount: 250000,
    currency: 'IDR',
    verifiedAt: '2026-10-05T08:30:00.000Z',
    proof: {
      originalName: 'bukti-transfer.pdf',
      mimeType: 'application/pdf',
      size: 4096,
      viewUrl: '/api/admin/paid-teams/registration-1/payment-proof',
      downloadUrl: '/api/admin/paid-teams/registration-1/payment-proof?download=true',
    },
  },
};

function createApi(record: PaidTeamDetailRecord = detail): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue(viewerSession),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    },
    admin: {
      getPaidTeam: vi.fn().mockResolvedValue(record),
    },
  } as unknown as RegistrationApi;
}

function renderPage(api: RegistrationApi) {
  return render(
    <MemoryRouter initialEntries={['/admin/tim-lunas/registration-1']}>
      <AuthProvider api={api}>
        <Routes>
          <Route
            path="/admin/tim-lunas/:registrationId"
            element={<AdminPaidTeamDetailPage api={api} />}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminPaidTeamDetailPage', () => {
  it('renders full team, member, photo, and payment-proof data as read-only', async () => {
    const api = createApi();
    renderPage(api);

    expect(await screen.findByRole('heading', { name: 'Garuda Robotika' })).toBeInTheDocument();
    expect(api.admin.getPaidTeam).toHaveBeenCalledWith('registration-1');
    expect(screen.getByText('Ayu Peserta')).toBeInTheDocument();
    expect(screen.getByText('ayu@example.test')).toBeInTheDocument();
    expect(screen.getByText('081234567890')).toBeInTheDocument();
    expect(screen.getByText('Chariot Line')).toBeInTheDocument();

    const member = screen.getByRole('article', { name: 'Anggota Budi Ketua' });
    expect(within(member).getByText('NRP-001')).toBeInTheDocument();
    expect(within(member).getByText('budi@example.test')).toBeInTheDocument();
    expect(within(member).getByRole('img', { name: 'Foto Budi Ketua' })).toHaveAttribute(
      'src',
      '/api/admin/paid-teams/registration-1/photos/photo-1',
    );
    expect(within(member).getByRole('link', { name: 'Unduh foto Budi Ketua' })).toHaveAttribute(
      'href',
      '/api/admin/paid-teams/registration-1/photos/photo-1?download=true',
    );
    expect(screen.getByText('Foto belum tersedia')).toBeInTheDocument();

    const payment = screen.getByRole('region', { name: 'Pembayaran' });
    expect(within(payment).getByText('INV-JRC-XIV-0015')).toBeInTheDocument();
    expect(within(payment).getByRole('link', { name: 'Buka bukti pembayaran' })).toHaveAttribute(
      'href',
      '/api/admin/paid-teams/registration-1/payment-proof',
    );
    expect(within(payment).getByRole('link', { name: 'Unduh bukti pembayaran' })).toHaveAttribute(
      'href',
      '/api/admin/paid-teams/registration-1/payment-proof?download=true',
    );
    expect(screen.queryByRole('button', { name: /ubah|hapus|setujui|tolak|verifikasi/i })).not.toBeInTheDocument();
  });

  it('shows a retry action after detail loading fails', async () => {
    const api = createApi();
    vi.mocked(api.admin.getPaidTeam).mockRejectedValueOnce(new Error('offline'));
    renderPage(api);

    expect(await screen.findByRole('alert')).toHaveTextContent('Detail tim gagal dimuat');
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
