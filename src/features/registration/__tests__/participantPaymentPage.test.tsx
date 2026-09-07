import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PortalPaymentPage from '../../../pages/portal/PortalPaymentPage';
import type { InvoiceRecord, RegistrationApi, RegistrationRecord } from '../api';

const registration: RegistrationRecord = {
  id: 'registration-1',
  registrationNumber: 'JRC14-2026-0001',
  competitionId: 'competition-1',
  teamName: 'Garuda Robotika',
  institution: 'PENS',
  status: 'APPROVED',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

const invoice: InvoiceRecord = {
  id: 'invoice-1',
  invoiceNumber: 'INV-JRC-0001',
  amount: 900_000,
  currency: 'IDR',
  provider: 'MANUAL_TRANSFER',
  instructions: {
    bankName: 'Bank Mandiri',
    accountName: 'JRC PENS',
    accountNumber: '1234567890',
    qrisImageUrl: 'https://cdn.example.test/qris.png',
    transferReference: 'INV-JRC-0001',
  },
  paymentStatus: 'UNPAID',
  deadline: '2026-09-20T16:59:59.000Z',
};

function createApi(): RegistrationApi {
  return {
    registrations: {
      get: vi.fn().mockResolvedValue(registration),
      invoice: vi.fn().mockResolvedValue(invoice),
    },
    invoices: {
      uploadProof: vi.fn().mockResolvedValue({
        ...invoice,
        paymentStatus: 'PENDING_VERIFICATION',
      }),
    },
  } as unknown as RegistrationApi;
}

function renderPage(api: RegistrationApi) {
  render(
    <MemoryRouter initialEntries={['/portal/pendaftaran/registration-1/pembayaran']}>
      <Routes>
        <Route
          path="/portal/pendaftaran/:registrationId/pembayaran"
          element={<PortalPaymentPage api={api} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PortalPaymentPage', () => {
  it('uploads proof as multipart file and keeps payment pending until finance verification', async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderPage(api);

    expect(await screen.findByRole('heading', { name: /pembayaran garuda robotika/i })).toBeInTheDocument();
    expect(screen.getByText('Bank Mandiri')).toBeInTheDocument();
    expect(screen.getByText('1234567890')).toBeInTheDocument();

    const proof = new File(['proof'], 'proof.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)'), proof);
    await user.click(screen.getByRole('button', { name: 'Unggah bukti' }));

    await waitFor(() => expect(api.invoices.uploadProof).toHaveBeenCalledTimes(1));
    const [invoiceId, body] = vi.mocked(api.invoices.uploadProof).mock.calls[0] ?? [];
    expect(invoiceId).toBe('invoice-1');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(proof);
    expect(await screen.findByText('Menunggu verifikasi')).toBeInTheDocument();
    expect(screen.getAllByText(/belum dinyatakan lunas/i)).not.toHaveLength(0);
    expect(screen.getByText(/pemeriksaan riwayat transaksi bank/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tandai.*lunas/i })).not.toBeInTheDocument();
  });
});
