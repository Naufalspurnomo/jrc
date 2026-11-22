import { PaymentStatus } from '@prisma/client';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { FinanceService } from '../src/finance';
import { PaymentVerificationService } from '../src/payment-verification';
import { PrismaService } from '../src/prisma.service';
import { PrivateStorageService } from '../src/private-storage';

const OWNER_ID = '048ed71f-fbf0-414a-96d2-9f625847002e';
const INVOICE_ID = '4fe8fb90-e44b-42c4-a4c4-4c671f1e34c6';
const OLD_KEY = 'a'.repeat(64);
const NEW_KEY = 'b'.repeat(64);
const FUTURE = new Date('2099-01-01T00:00:00.000Z');

function proofFile(
  mimeType = 'application/pdf',
  buffer = Buffer.from('%PDF-proof'),
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: '../proof.pdf',
    encoding: '7bit',
    mimetype: mimeType,
    size: buffer.length,
    buffer,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
  };
}

function invoiceResult() {
  return {
    id: INVOICE_ID,
    invoiceNumber: 'INV-1',
    amount: 100,
    currency: 'IDR',
    provider: 'MANUAL',
    instructions: {},
    paymentStatus: PaymentStatus.PENDING_VERIFICATION,
    deadline: FUTURE,
    proofOriginalName: 'proof.pdf',
    proofMimeType: 'application/pdf',
    proofSize: proofFile().size,
    verificationReason: null,
    verifiedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('payment-proof storage integration', () => {
  it('uploads through the adapter and deletes the replaced object after commit', async () => {
    process.env.TICKET_SECRET = 'test-ticket-secret-that-is-long-enough';
    const current = {
      id: INVOICE_ID,
      invoiceNumber: 'INV-1',
      amount: 100,
      currency: 'IDR',
      registration: {
        owner: { email: 'owner@example.test', displayName: 'Owner' },
      },
      paymentStatus: PaymentStatus.REJECTED,
      deadline: FUTURE,
      proofStorageKey: OLD_KEY,
      proofOriginalName: 'old.pdf',
      proofMimeType: 'application/pdf',
      proofSize: 10,
      verificationReason: 'retry',
      verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const transaction = {
      invoice: {
        findFirst: vi.fn().mockResolvedValue(current),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue(invoiceResult()),
      },
      emailOutbox: { create: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      invoice: { findFirst: vi.fn().mockResolvedValue(current) },
      $transaction: vi.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };
    const storage = {
      upload: vi.fn().mockResolvedValue(NEW_KEY),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentVerificationService(
      prisma as unknown as PrismaService,
      storage as unknown as PrivateStorageService,
    );

    const result = await service.uploadProof(
      OWNER_ID,
      INVOICE_ID,
      proofFile(),
      { requestId: 'request-id', ipAddress: null },
    );

    expect(storage.upload).toHaveBeenCalledWith(
      proofFile().buffer,
      'application/pdf',
    );
    expect(transaction.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ proofStorageKey: NEW_KEY }),
      }),
    );
    expect(storage.delete).toHaveBeenCalledOnce();
    expect(storage.delete).toHaveBeenCalledWith(OLD_KEY);
    expect(result).not.toHaveProperty('proof.storageKey');
  });

  it('deletes the newly uploaded object when the database transaction fails', async () => {
    const current = {
      paymentStatus: PaymentStatus.UNPAID,
      deadline: FUTURE,
      proofStorageKey: null,
      proofOriginalName: null,
      proofMimeType: null,
      proofSize: null,
    };
    const prisma = {
      invoice: { findFirst: vi.fn().mockResolvedValue(current) },
      $transaction: vi.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const storage = {
      upload: vi.fn().mockResolvedValue(NEW_KEY),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentVerificationService(
      prisma as unknown as PrismaService,
      storage as unknown as PrivateStorageService,
    );

    await expect(
      service.uploadProof(OWNER_ID, INVOICE_ID, proofFile(), {
        requestId: 'request-id',
        ipAddress: null,
      }),
    ).rejects.toThrow('database unavailable');
    expect(storage.delete).toHaveBeenCalledWith(NEW_KEY);
  });

  it.each(['image/jpg', 'application/octet-stream'])(
    'sniffs a JPEG uploaded as %s and stores the canonical image/jpeg MIME type',
    async (browserMimeType) => {
      const jpg = proofFile(browserMimeType, Buffer.from([0xff, 0xd8, 0xff, 0x00]));
      const current = {
        id: INVOICE_ID,
        invoiceNumber: 'INV-1',
        amount: 100,
        currency: 'IDR',
        registration: { owner: { email: 'owner@example.test', displayName: 'Owner' } },
        paymentStatus: PaymentStatus.UNPAID,
        deadline: FUTURE,
        proofStorageKey: null,
        proofOriginalName: null,
        proofMimeType: null,
        proofSize: null,
        verificationReason: null,
        verifiedAt: null,
      };
      const transaction = {
        invoice: {
          findFirst: vi.fn().mockResolvedValue(current),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({
            ...invoiceResult(),
            proofOriginalName: jpg.originalname,
            proofMimeType: 'image/jpeg',
            proofSize: jpg.size,
          }),
        },
        emailOutbox: { create: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      const prisma = {
        invoice: { findFirst: vi.fn().mockResolvedValue(current) },
        $transaction: vi.fn((operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction)),
      };
      const storage = {
        upload: vi.fn().mockResolvedValue(NEW_KEY),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      const service = new PaymentVerificationService(
        prisma as unknown as PrismaService,
        storage as unknown as PrivateStorageService,
      );

      await service.uploadProof(OWNER_ID, INVOICE_ID, jpg, {
        requestId: 'request-id',
        ipAddress: null,
      });

      expect(storage.upload).toHaveBeenCalledWith(jpg.buffer, 'image/jpeg');
      expect(transaction.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ proofMimeType: 'image/jpeg' }),
      }));
    },
  );

  it('rejects unsupported bytes before writing them to private storage', async () => {
    const storage = {
      upload: vi.fn(),
      delete: vi.fn(),
    };
    const service = new PaymentVerificationService(
      {} as PrismaService,
      storage as unknown as PrivateStorageService,
    );
    const invalid = proofFile(
      'application/octet-stream',
      Buffer.from('not-a-supported-payment-proof'),
    );

    await expect(
      service.uploadProof(OWNER_ID, INVOICE_ID, invalid, {
        requestId: 'request-id',
        ipAddress: null,
      }),
    ).rejects.toThrow('Payment proof must be a PNG, JPEG, or PDF');
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe('finance proof storage integration', () => {
  it('returns the adapter stream only after finance service lookup and validation', async () => {
    const stream = Readable.from('proof');
    const prisma = {
      invoice: {
        findUnique: vi.fn().mockResolvedValue({
          proofStorageKey: OLD_KEY,
          proofMimeType: 'application/pdf',
          proofSize: 5,
        }),
      },
    };
    const storage = { read: vi.fn().mockResolvedValue({ stream, size: 5 }) };
    const service = new FinanceService(
      prisma as unknown as PrismaService,
      storage as unknown as PrivateStorageService,
    );

    await expect(service.proof(INVOICE_ID)).resolves.toEqual({
      stream,
      mimeType: 'application/pdf',
      size: 5,
    });
    expect(storage.read).toHaveBeenCalledWith(OLD_KEY);
  });

  it('rejects a proof whose trusted stored size differs from the invoice', async () => {
    const stream = Readable.from('proof!');
    const prisma = { invoice: { findUnique: vi.fn().mockResolvedValue({
      proofStorageKey: OLD_KEY, proofMimeType: 'application/pdf', proofSize: 5,
    }) } };
    const storage = { read: vi.fn().mockResolvedValue({ stream, size: 6 }) };
    const service = new FinanceService(prisma as unknown as PrismaService, storage as unknown as PrivateStorageService);

    await expect(service.proof(INVOICE_ID)).rejects.toMatchObject({ status: 404 });
    expect(stream.readableFlowing).toBeNull();
  });
});
