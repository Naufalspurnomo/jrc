import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import AdminFinancePage from '../../../pages/admin/AdminFinancePage';
import type {
  AuthSession,
  FinanceInvoiceRecord,
  RegistrationApi,
} from '../api';

const financeSession: AuthSession = {
  user: {
    id: 'finance-1',
    displayName: 'Dewi Finance',
    email: 'finance@example.test',
    role: 'FINANCE',
  },
};

const pendingInvoice: FinanceInvoiceRecord = {
  id: 'invoice-1',
  invoiceNumber: 'INV-JRC-0001',
  amount: 900_000,
  currency: 'IDR',
  paymentStatus: 'PENDING_VERIFICATION',
  deadline: '2026-09-20T16:59:59.000Z',
  proof: {
    originalName: 'bukti-transfer.pdf',
    mimeType: 'application/pdf',
    size: 2_048,
  },
  verificationReason: null,
  verifiedAt: null,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
  registration: {
    id: 'registration-1',
    registrationNumber: 'JRC14-2026-0001',
    teamName: 'Garuda Robotika',
    institution: 'PENS',
    owner: { displayName: 'Ayu Ketua' },
    competition: { id: 'competition-1', name: 'Ring Rumble — Sumo' },
  },
};

function createApi(invoices: FinanceInvoiceRecord[] = [pendingInvoice]): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue(financeSession),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    },
    admin: {
      listFinanceInvoices: vi.fn().mockResolvedValue(invoices),
      verifyPayment: vi.fn().mockResolvedValue({
        ...pendingInvoice,
        paymentStatus: 'PAID',
      }),
    },
  } as unknown as RegistrationApi;
}

function renderFinance(api: RegistrationApi) {
  return render(
    <MemoryRouter>
      <AuthProvider api={api}>
        <AdminFinancePage api={api} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminFinancePage', () => {
  it('shows the pending finance queue with only role-safe proof and registration fields', async () => {
    const unsafeInvoice = {
      ...pendingInvoice,
      proofStorageKey: 'hidden-storage-key',
      registration: {
        ...pendingInvoice.registration,
        phone: '+628123456789',
        owner: {
          ...pendingInvoice.registration.owner,
          email: 'participant@example.test',
        },
      },
    } as FinanceInvoiceRecord;
    const api = createApi([unsafeInvoice]);

    renderFinance(api);

    const item = await screen.findByRole('article', { name: 'Invoice INV-JRC-0001' });
    expect(within(item).getByText('Garuda Robotika')).toBeInTheDocument();
    expect(within(item).getByText('PENS')).toBeInTheDocument();
    expect(within(item).getByText('Ring Rumble — Sumo')).toBeInTheDocument();
    expect(within(item).getByText('Ayu Ketua')).toBeInTheDocument();
    expect(within(item).getByText(/Rp\s*900\.000/)).toBeInTheDocument();
    expect(within(item).getByText(/20 September 2026/)).toBeInTheDocument();
    expect(within(item).getByText('bukti-transfer.pdf')).toBeInTheDocument();
    expect(within(item).getByText('application/pdf · 2 KB')).toBeInTheDocument();
    expect(within(item).getByText('Menunggu verifikasi')).toBeInTheDocument();
    expect(within(item).getByRole('link', { name: 'Buka bukti pembayaran' })).toHaveAttribute(
      'href',
      '/api/admin/finance/invoices/invoice-1/proof',
    );
    expect(screen.queryByText('hidden-storage-key')).not.toBeInTheDocument();
    expect(screen.queryByText('participant@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('+628123456789')).not.toBeInTheDocument();
    expect(api.admin.verifyPayment).not.toHaveBeenCalled();
  });

  it('requires an explicit reference before marking paid and removes the resolved invoice', async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderFinance(api);

    const item = await screen.findByRole('article', { name: 'Invoice INV-JRC-0001' });
    await user.click(within(item).getByRole('button', { name: 'Tandai lunas' }));

    expect(api.admin.verifyPayment).not.toHaveBeenCalled();
    expect(within(item).getByRole('alert')).toHaveTextContent(/alasan atau referensi/i);

    await user.type(
      within(item).getByLabelText('Alasan atau referensi verifikasi'),
      'Mutasi Mandiri 20-09-2026 #4812',
    );
    await user.click(within(item).getByRole('button', { name: 'Tandai lunas' }));

    await waitFor(() => expect(api.admin.verifyPayment).toHaveBeenCalledWith('invoice-1', {
      status: 'PAID',
      reason: 'Mutasi Mandiri 20-09-2026 #4812',
    }));
    expect(await screen.findByText('Tidak ada bukti pembayaran yang menunggu verifikasi.')).toBeInTheDocument();
    expect(screen.queryByText('Garuda Robotika')).not.toBeInTheDocument();
  });

  it('requires a rejection reason and sends the explicit finance decision', async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderFinance(api);

    const item = await screen.findByRole('article', { name: 'Invoice INV-JRC-0001' });
    await user.type(within(item).getByLabelText('Alasan atau referensi verifikasi'), 'Nominal tidak cocok');
    await user.click(within(item).getByRole('button', { name: 'Tolak bukti' }));

    await waitFor(() => expect(api.admin.verifyPayment).toHaveBeenCalledWith('invoice-1', {
      status: 'REJECTED',
      reason: 'Nominal tidak cocok',
    }));
  });

  it('shows loading, error with retry, and empty queue states', async () => {
    let rejectLoad: ((reason?: unknown) => void) | undefined;
    const api = createApi([]);
    vi.mocked(api.admin.listFinanceInvoices).mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectLoad = reject;
    }));
    const user = userEvent.setup();
    renderFinance(api);

    expect(await screen.findByRole('status')).toHaveTextContent('Memuat antrean pembayaran');
    await act(async () => {
      rejectLoad?.(new Error('offline'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Antrean pembayaran gagal dimuat');

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Tidak ada bukti pembayaran yang menunggu verifikasi.')).toBeInTheDocument();
    expect(api.admin.listFinanceInvoices).toHaveBeenCalledTimes(2);
  });
});