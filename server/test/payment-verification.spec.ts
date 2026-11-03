import { PaymentStatus, TicketStatus } from '@prisma/client';
import QRCode from 'qrcode';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashTicketToken, deriveTicketToken } from '../src/common/ticket-token';
import {
  buildPortalReceiptUrl,
  PaymentVerificationService,
  renderRichTextEmail,
} from '../src/payment-verification';
import { PrismaService } from '../src/prisma.service';
import { PrivateStorageService } from '../src/private-storage';

const INVOICE_ID = '2fb94b45-fc0e-4bda-ab7c-2526a976f1d7';
const OWNER_ID = '96c73270-62d3-46b7-941a-3ab31788197e';
const PROOF_STORAGE_KEY = 'a'.repeat(64);

const ORIGINAL_ENV = { ...process.env };
const qrCodePromiseApi = QRCode as unknown as {
  toDataURL(text: string, options?: object): Promise<string>;
};

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

function uploadService(deadline: Date): {
  service: PaymentVerificationService;
  storage: { upload: ReturnType<typeof vi.fn> };
  transaction: { invoice: { updateMany: ReturnType<typeof vi.fn> } };
} {
  const invoice = {
    id: INVOICE_ID,
    invoiceNumber: 'INV-JRC-0001',
    amount: 900_000,
    currency: 'IDR',
    provider: 'MANUAL_TRANSFER',
    instructions: {},
    paymentStatus: PaymentStatus.UNPAID,
    deadline,
    proofStorageKey: null,
    proofOriginalName: null,
    proofMimeType: null,
    proofSize: null,
    verificationReason: null,
    verifiedAt: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    registration: {
      owner: { email: 'participant@example.test', displayName: 'Participant' },
    },
  };
  const transaction = {
    invoice: {
      findFirst: vi.fn().mockResolvedValue(invoice),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({
        ...invoice,
        paymentStatus: PaymentStatus.PENDING_VERIFICATION,
        proofOriginalName: 'proof.pdf',
        proofMimeType: 'application/pdf',
        proofSize: 10,
      }),
    },
    emailOutbox: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    invoice: { findFirst: vi.fn().mockResolvedValue(invoice) },
    $transaction: vi.fn((operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction)),
  };
  const storage = {
    upload: vi.fn().mockResolvedValue(PROOF_STORAGE_KEY),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  return {
    service: new PaymentVerificationService(
      prisma as unknown as PrismaService,
      storage as unknown as PrivateStorageService,
    ),
    storage,
    transaction,
  };
}

const validPdf = {
  originalname: 'proof.pdf',
  size: 10,
  buffer: Buffer.from('%PDF-1.7\n'),
} as Express.Multer.File;

const audit = { requestId: 'request-id', ipAddress: '127.0.0.1' };

describe('payment proof upload window', () => {
  it('accepts proof after the invoice deadline while the invoice is still unpaid', async () => {
    process.env.TICKET_SECRET = 'test-secret-at-least-32-characters-long';
    const { service, storage, transaction } = uploadService(
      new Date('2020-01-01T00:00:00.000Z'),
    );

    const result = await service.uploadProof(OWNER_ID, INVOICE_ID, validPdf, audit);

    expect(result.paymentStatus).toBe(PaymentStatus.PENDING_VERIFICATION);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(transaction.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: INVOICE_ID,
          paymentStatus: PaymentStatus.UNPAID,
        }),
      }),
    );
  });
});

describe('paid ticket email rendering', () => {
  it('builds the exact authenticated registration payment route', () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_FRONTEND_URL = 'https://jrc.example.test';
    expect(buildPortalReceiptUrl('registration/id')).toBe(
      'https://jrc.example.test/portal/pendaftaran/registration%2Fid/pembayaran',
    );
  });
  it('escapes every HTML-significant character while preserving literal plain text', () => {
    const text = `Halo <img src=x onerror="alert('x')"> & "quoted",\nInvoice: INV<>&"'\nReferensi rekonsiliasi: <b>paid</b>\nVerifikasi tiket: https://example.test/?a=1&b=<tag>`;

    expect(renderRichTextEmail(text)).toEqual({
      text,
      html: `<p>Halo &lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; &quot;quoted&quot;,<br>Invoice: INV&lt;&gt;&amp;&quot;&#39;<br>Referensi rekonsiliasi: &lt;b&gt;paid&lt;/b&gt;<br>Verifikasi tiket: https://example.test/?a=1&amp;b=&lt;tag&gt;</p>`,
    });
  });
});

function serviceWithRegistration(registration: object): PaymentVerificationService {
  const prisma = {
    registration: {
      findFirst: vi.fn().mockResolvedValue(registration),
    },
  };
  return new PaymentVerificationService(prisma as unknown as PrismaService);
}

describe('participant ticket response', () => {
  it('returns safe ticket fields and encodes the verification URL in the QR image', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TICKET_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.PUBLIC_VERIFICATION_URL =
      'https://tickets.example.test/ticket/verify?source=portal';

    const ticketId = '7c60de75-6794-49de-8292-8b53a417ab1d';
    const token = deriveTicketToken(ticketId, process.env.TICKET_SECRET);
    const issuedAt = new Date('2026-09-07T12:34:56.000Z');
    const service = serviceWithRegistration({
      teamName: 'Garuda Robotika',
      registrationNumber: 'JRC14-2026-0001',
      competition: {
        name: 'Colosseum Clash',
        eventId: 'JRC-XIV-2026',
        eventName: 'JRC XIV 2026',
      },
      ticket: {
        id: ticketId,
        tokenHash: hashTicketToken(token),
        status: TicketStatus.ACTIVE,
        issuedAt,
      },
    });
    const qrSpy = vi
      .spyOn(qrCodePromiseApi, 'toDataURL')
      .mockResolvedValue('data:image/png;base64,cXItcG5n');

    const result = await service.getTicket('owner-id', 'registration-id');
    const verificationUrl = new URL(result.verificationUrl);

    expect(verificationUrl.origin + verificationUrl.pathname).toBe(
      'https://tickets.example.test/ticket/verify',
    );
    expect(verificationUrl.searchParams.get('source')).toBe('portal');
    expect(verificationUrl.searchParams.get('token')).toBe(token);
    expect(verificationUrl.searchParams.get('eventId')).toBe('JRC-XIV-2026');
    expect(qrSpy).toHaveBeenCalledWith(result.verificationUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      type: 'image/png',
    });
    expect(result).toEqual({
      token,
      verificationUrl: verificationUrl.toString(),
      qrDataUrl: 'data:image/png;base64,cXItcG5n',
      status: TicketStatus.ACTIVE,
      teamName: 'Garuda Robotika',
      registrationNumber: 'JRC14-2026-0001',
      competitionName: 'Colosseum Clash',
      eventName: 'JRC XIV 2026',
      issuedAt: '2026-09-07T12:34:56.000Z',
    });
    expect(qrSpy.mock.calls[0]?.[0]).not.toBe(token);
  });

  it.each([
    ['ftp://tickets.example.test/ticket/verify', 'http or https'],
    ['https://user:password@tickets.example.test/ticket/verify', 'credentials'],
    ['not a URL', 'valid URL'],
  ])('rejects unsafe PUBLIC_VERIFICATION_URL %s', async (configuredUrl, message) => {
    process.env.NODE_ENV = 'test';
    process.env.TICKET_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.PUBLIC_VERIFICATION_URL = configuredUrl;
    const ticketId = '7c60de75-6794-49de-8292-8b53a417ab1d';
    const token = deriveTicketToken(ticketId, process.env.TICKET_SECRET);
    const service = serviceWithRegistration({
      teamName: 'Garuda Robotika',
      registrationNumber: 'JRC14-2026-0001',
      competition: {
        name: 'Colosseum Clash',
        eventId: 'JRC-XIV-2026',
        eventName: 'JRC XIV 2026',
      },
      ticket: {
        id: ticketId,
        tokenHash: hashTicketToken(token),
        status: TicketStatus.ACTIVE,
        issuedAt: new Date('2026-09-07T12:34:56.000Z'),
      },
    });

    await expect(service.getTicket('owner-id', 'registration-id')).rejects.toThrow(
      message,
    );
  });

  it('uses the local verification URL only outside production', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TICKET_SECRET = 'test-secret-at-least-32-characters-long';
    delete process.env.PUBLIC_VERIFICATION_URL;
    const ticketId = '7c60de75-6794-49de-8292-8b53a417ab1d';
    const token = deriveTicketToken(ticketId, process.env.TICKET_SECRET);
    const service = serviceWithRegistration({
      teamName: 'Garuda Robotika',
      registrationNumber: 'JRC14-2026-0001',
      competition: {
        name: 'Colosseum Clash',
        eventId: 'JRC-XIV-2026',
        eventName: 'JRC XIV 2026',
      },
      ticket: {
        id: ticketId,
        tokenHash: hashTicketToken(token),
        status: TicketStatus.ACTIVE,
        issuedAt: new Date('2026-09-07T12:34:56.000Z'),
      },
    });
    vi.spyOn(qrCodePromiseApi, 'toDataURL').mockResolvedValue(
      'data:image/png;base64,cXItcG5n',
    );

    const result = await service.getTicket('owner-id', 'registration-id');

    expect(result.verificationUrl).toBe(
      `http://localhost:5173/ticket/verify?token=${token}&eventId=JRC-XIV-2026`,
    );
  });

  it('requires PUBLIC_VERIFICATION_URL in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TICKET_SECRET = 'test-secret-at-least-32-characters-long';
    delete process.env.PUBLIC_VERIFICATION_URL;
    const ticketId = '7c60de75-6794-49de-8292-8b53a417ab1d';
    const token = deriveTicketToken(ticketId, process.env.TICKET_SECRET);
    const service = serviceWithRegistration({
      teamName: 'Garuda Robotika',
      registrationNumber: 'JRC14-2026-0001',
      competition: {
        name: 'Colosseum Clash',
        eventId: 'JRC-XIV-2026',
        eventName: 'JRC XIV 2026',
      },
      ticket: {
        id: ticketId,
        tokenHash: hashTicketToken(token),
        status: TicketStatus.ACTIVE,
        issuedAt: new Date('2026-09-07T12:34:56.000Z'),
      },
    });

    await expect(service.getTicket('owner-id', 'registration-id')).rejects.toThrow(
      'PUBLIC_VERIFICATION_URL is required in production',
    );
  });
});