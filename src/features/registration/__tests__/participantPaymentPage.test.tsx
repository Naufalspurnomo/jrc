import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PortalPaymentPage from '../../../pages/portal/PortalPaymentPage';
import { ApiError, type InvoiceRecord, type RegistrationApi, type RegistrationRecord } from '../api';

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
  deadline: '2099-09-20T16:59:59.000Z',
  proofUploadAllowed: true,
  verificationReason: null,
  verifiedAt: null,
};

function createApi(invoiceOverride: Partial<InvoiceRecord> = {}): RegistrationApi {
  const currentInvoice = { ...invoice, ...invoiceOverride };
  return {
    registrations: {
      get: vi.fn().mockResolvedValue(registration),
      invoice: vi.fn().mockResolvedValue(currentInvoice),
    },
    invoices: {
      uploadProof: vi.fn().mockResolvedValue({
        ...currentInvoice,
        paymentStatus: 'PENDING_VERIFICATION',
        verificationReason: null,
        verifiedAt: null,
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

async function waitForPage() {
  await screen.findByRole('heading', { name: /pembayaran garuda robotika/i });
}

describe('PortalPaymentPage', () => {
  it('shows payment instructions and allows proof upload for an unpaid invoice', async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderPage(api);
    await waitForPage();

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
  });

  it('accepts the image/jpg MIME type sent by some Windows browsers', async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderPage(api);
    await waitForPage();

    const proof = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'proof.jpg', { type: 'image/jpg' });
    await user.upload(screen.getByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)'), proof);
    await user.click(screen.getByRole('button', { name: 'Unggah bukti' }));

    await waitFor(() => expect(api.invoices.uploadProof).toHaveBeenCalledTimes(1));
  });

  it('allows a supported extension when a browser reports a generic MIME type', async () => {
    const api = createApi();
    const user = userEvent.setup({ applyAccept: false });
    renderPage(api);
    await waitForPage();

    const proof = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'proof.jpg', {
      type: 'application/octet-stream',
    });
    await user.upload(screen.getByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)'), proof);
    await user.click(screen.getByRole('button', { name: 'Unggah bukti' }));

    await waitFor(() => expect(api.invoices.uploadProof).toHaveBeenCalledTimes(1));
  });

  it('allows proof upload after the informational payment due date', async () => {
    const api = createApi({
      deadline: '2020-09-20T16:59:59.000Z',
      proofUploadAllowed: true,
    });
    const user = userEvent.setup();
    renderPage(api);
    await waitForPage();

    expect(screen.getByText(/batas pembayaran telah lewat/i)).toBeInTheDocument();
    const proof = new File(['proof'], 'proof.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)'), proof);
    await user.click(screen.getByRole('button', { name: 'Unggah bukti' }));

    await waitFor(() => expect(api.invoices.uploadProof).toHaveBeenCalledTimes(1));
  });

  it('asks the participant to sign in again on a 401 session expiry', async () => {
    const api = createApi();
    vi.mocked(api.invoices.uploadProof).mockRejectedValue(
      new ApiError(401, { message: 'Authentication required' }),
    );
    const user = userEvent.setup();
    renderPage(api);
    await waitForPage();

    await user.upload(
      screen.getByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)'),
      new File(['proof'], 'proof.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Unggah bukti' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/masuk kembali/i);
  });

  it('does not mislabel a 403 rejection as an expired session', async () => {
    const api = createApi();
    vi.mocked(api.invoices.uploadProof).mockRejectedValue(
      new ApiError(403, { message: 'Invalid CSRF token' }),
    );
    const user = userEvent.setup();
    renderPage(api);
    await waitForPage();

    await user.upload(
      screen.getByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)'),
      new File(['proof'], 'proof.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Unggah bukti' }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/muat ulang/i);
    expect(error).not.toHaveTextContent(/sesi/i);
  });

  it('says an uploaded proof awaits finance verification', async () => {
    renderPage(createApi({ paymentStatus: 'PENDING_VERIFICATION' }));
    await waitForPage();

    expect(screen.getByText('Menunggu verifikasi')).toBeInTheDocument();
    expect(screen.getByText(/bukti pembayaran.*menunggu verifikasi tim keuangan/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)')).not.toBeInTheDocument();
  });

  it('shows the exact rejection reason and uploads a replacement proof', async () => {
    const reason = 'Nominal pada bukti transfer tidak sesuai tagihan.';
    const api = createApi({ paymentStatus: 'REJECTED', verificationReason: reason });
    const user = userEvent.setup();
    renderPage(api);
    await waitForPage();

    expect(screen.getByRole('alert')).toHaveTextContent(reason);
    expect(screen.queryByText(/pemeriksaan riwayat transaksi bank/i)).not.toBeInTheDocument();

    const replacement = new File(['replacement'], 'replacement.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)'), replacement);
    await user.click(screen.getByRole('button', { name: 'Unggah bukti pengganti' }));

    await waitFor(() => expect(api.invoices.uploadProof).toHaveBeenCalledTimes(1));
    const [invoiceId, body] = vi.mocked(api.invoices.uploadProof).mock.calls[0] ?? [];
    expect(invoiceId).toBe('invoice-1');
    expect((body as FormData).get('file')).toBe(replacement);
    expect(await screen.findByText('Menunggu verifikasi')).toBeInTheDocument();
    expect(screen.queryByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)')).not.toBeInTheDocument();
  });

  it('shows an official paid receipt with ticket link and no upload controls', async () => {
    renderPage(createApi({
      paymentStatus: 'PAID',
      verifiedAt: '2026-09-21T03:30:00.000Z',
    }));
    await waitForPage();

    const receipt = screen.getByRole('region', { name: 'Kuitansi pembayaran resmi' });
    expect(receipt).toHaveTextContent('INV-JRC-0001');
    expect(receipt).toHaveTextContent(/Rp\s*900\.000/);
    expect(receipt).toHaveTextContent(/21 September 2026.*10\.30/);
    expect(receipt).toHaveTextContent('Pembayaran resmi tercatat. Pendaftaran Anda telah resmi terdaftar.');
    const ticketLink = screen.getByRole('link', { name: 'Lihat tiket peserta' });
    expect(ticketLink).toHaveAttribute(
      'href',
      '/portal/pendaftaran/registration-1/tiket',
    );
    expect(ticketLink).toHaveClass('portal-button');
    expect(screen.queryByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)')).not.toBeInTheDocument();
    expect(screen.queryByText(/pemeriksaan riwayat transaksi bank/i)).not.toBeInTheDocument();
  });

  it('does not allow proof upload or show pending copy for a refunded invoice', async () => {
    renderPage(createApi({ paymentStatus: 'REFUNDED' }));
    await waitForPage();

    expect(screen.getByText('Pembayaran dikembalikan')).toBeInTheDocument();
    expect(screen.queryByLabelText('Bukti pembayaran (PDF, JPEG, atau PNG)')).not.toBeInTheDocument();
    expect(screen.queryByText(/pemeriksaan riwayat transaksi bank/i)).not.toBeInTheDocument();
  });
});
