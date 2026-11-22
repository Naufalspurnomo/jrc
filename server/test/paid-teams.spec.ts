import { NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../src/auth';
import { PaidTeamsController, PaidTeamsService } from '../src/paid-teams';
import { PrismaService } from '../src/prisma.service';
import { PrivateStorageService } from '../src/private-storage';

const REGISTRATION_ID = '70b8a05e-132a-4ea0-949c-f5bd13f6c3b8';
const DOCUMENT_ID = '369ba17a-5974-46a3-ad61-f12015d4a32d';
const STORAGE_KEY = 'a'.repeat(64);

const paidInvoice = {
  id: 'invoice-1',
  paymentStatus: PaymentStatus.PAID,
  verifiedAt: new Date('2026-10-05T08:30:00.000Z'),
  registration: {
    id: REGISTRATION_ID,
    registrationNumber: 'JRC-XIV-0015',
    teamName: 'Garuda Robotika',
    institution: 'PENS',
    competition: {
      id: 'competition-1',
      name: 'Chariot Line',
      level: 'Umum',
      discipline: 'Line Follower Mikro',
    },
  },
};

describe('Paid team read-only list', () => {
  it('restricts the endpoint to the dedicated paid-team viewer role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PaidTeamsController)).toEqual(['PAID_TEAM_VIEWER']);
  });

  it('queries only paid invoices and returns the minimal team contract', async () => {
    const prisma = {
      invoice: { findMany: vi.fn().mockResolvedValue([paidInvoice]) },
    };
    const service = new PaidTeamsService(prisma as unknown as PrismaService);

    await expect(service.list({ query: ' garuda ', page: 1, pageSize: 25 })).resolves.toEqual({
      items: [
        {
          id: REGISTRATION_ID,
          registrationNumber: 'JRC-XIV-0015',
          teamName: 'Garuda Robotika',
          institution: 'PENS',
          competition: paidInvoice.registration.competition,
          verifiedAt: '2026-10-05T08:30:00.000Z',
        },
      ],
      page: 1,
      pageSize: 25,
      hasNextPage: false,
    });
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ paymentStatus: PaymentStatus.PAID }),
      skip: 0,
      take: 26,
    }));
    const payload = JSON.stringify(await service.list({}));
    expect(payload).not.toMatch(/invoice-1|proof|amount|verificationReason|owner|phone|email|member/i);
  });

  it('reports a next page without returning the look-ahead record', async () => {
    const prisma = {
      invoice: { findMany: vi.fn().mockResolvedValue([paidInvoice, paidInvoice, paidInvoice]) },
    };
    const service = new PaidTeamsService(prisma as unknown as PrismaService);

    const result = await service.list({ page: 2, pageSize: 2 });

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.hasNextPage).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 2, take: 3 }));
  });
});

describe('Paid team read-only detail and files', () => {
  const detailInvoice = {
    id: 'invoice-1',
    invoiceNumber: 'INV-JRC-XIV-0015',
    amount: 250_000,
    currency: 'IDR',
    paymentStatus: PaymentStatus.PAID,
    verifiedAt: new Date('2026-10-05T08:30:00.000Z'),
    proofOriginalName: 'bukti-transfer.pdf',
    proofMimeType: 'application/pdf',
    proofSize: 10,
    registration: {
      id: REGISTRATION_ID,
      registrationNumber: 'JRC-XIV-0015',
      teamName: 'Garuda Robotika',
      institution: 'PENS',
      phone: '081234567890',
      status: 'APPROVED',
      submittedAt: new Date('2026-10-01T08:00:00.000Z'),
      createdAt: new Date('2026-09-30T08:00:00.000Z'),
      updatedAt: new Date('2026-10-05T08:30:00.000Z'),
      owner: { displayName: 'Ayu Peserta', email: 'ayu@example.test' },
      competition: {
        id: 'competition-1', name: 'Chariot Line', level: 'Umum',
        discipline: 'Line Follower Mikro', eventName: 'JRC XIV',
      },
      members: [
        {
          id: 'member-1', name: 'Budi Ketua', studentId: 'NRP-001', role: 'LEADER',
          email: 'budi@example.test', phone: '081111111111',
        },
        {
          id: 'member-2', name: 'Rina Pembina', studentId: null, role: 'SUPERVISOR',
          email: null, phone: null,
        },
      ],
      documents: [{
        id: DOCUMENT_ID, category: 'MEMBER_PHOTO', originalName: 'budi.jpg',
        mimeType: 'image/jpeg', size: 9, subjectName: 'Budi Ketua',
        subjectRole: 'PARTICIPANT',
      }],
    },
  };

  it('returns complete operational detail only for a paid registration without storage keys', async () => {
    const prisma = { invoice: { findFirst: vi.fn().mockResolvedValue(detailInvoice) } };
    const service = new PaidTeamsService(prisma as unknown as PrismaService);

    const result = await service.detail(REGISTRATION_ID);

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { registrationId: REGISTRATION_ID, paymentStatus: PaymentStatus.PAID },
    }));
    expect(result).toMatchObject({
      id: REGISTRATION_ID,
      teamName: 'Garuda Robotika',
      phone: '081234567890',
      owner: { displayName: 'Ayu Peserta', email: 'ayu@example.test' },
      members: [
        expect.objectContaining({
          id: 'member-1',
          name: 'Budi Ketua',
          photo: expect.objectContaining({
            id: DOCUMENT_ID,
            viewUrl: `/api/admin/paid-teams/${REGISTRATION_ID}/photos/${DOCUMENT_ID}`,
            downloadUrl: `/api/admin/paid-teams/${REGISTRATION_ID}/photos/${DOCUMENT_ID}?download=true`,
          }),
        }),
        expect.objectContaining({ id: 'member-2', photo: null }),
      ],
      payment: {
        invoiceNumber: 'INV-JRC-XIV-0015',
        amount: 250_000,
        currency: 'IDR',
        verifiedAt: '2026-10-05T08:30:00.000Z',
        proof: expect.objectContaining({
          originalName: 'bukti-transfer.pdf',
          viewUrl: `/api/admin/paid-teams/${REGISTRATION_ID}/payment-proof`,
          downloadUrl: `/api/admin/paid-teams/${REGISTRATION_ID}/payment-proof?download=true`,
        }),
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/storageKey|verificationReason|verifiedBy|instructions/i);
  });

  it('returns 404 for missing or non-paid registrations', async () => {
    const prisma = { invoice: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = new PaidTeamsService(prisma as unknown as PrismaService);

    await expect(service.detail(REGISTRATION_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not assign one photo to multiple roster members with the same name', async () => {
    const duplicateNameInvoice = {
      ...detailInvoice,
      registration: {
        ...detailInvoice.registration,
        members: [
          detailInvoice.registration.members[0],
          {
            ...detailInvoice.registration.members[0],
            id: 'member-duplicate',
            role: 'MEMBER',
          },
        ],
      },
    };
    const prisma = { invoice: { findFirst: vi.fn().mockResolvedValue(duplicateNameInvoice) } };
    const service = new PaidTeamsService(prisma as unknown as PrismaService);

    const result = await service.detail(REGISTRATION_ID);

    expect(result.members).toEqual([
      expect.objectContaining({ id: 'member-1', photo: null }),
      expect.objectContaining({ id: 'member-duplicate', photo: null }),
    ]);
  });

  it('opens only a member photo belonging to a paid registration', async () => {
    const stream = Readable.from('photo');
    const prisma = {
      invoice: { findFirst: vi.fn().mockResolvedValue({ registration: { documents: [{
        storageKey: STORAGE_KEY,
        originalName: 'budi.jpg',
        mimeType: 'image/jpeg',
        size: 5,
      }] } }) },
    };
    const storage = { read: vi.fn().mockResolvedValue({ stream, size: 5 }) };
    const service = new PaidTeamsService(
      prisma as unknown as PrismaService,
      storage as unknown as PrivateStorageService,
    );

    await expect(service.memberPhoto(REGISTRATION_ID, DOCUMENT_ID)).resolves.toEqual({
      stream, originalName: 'budi.jpg', mimeType: 'image/jpeg', size: 5,
    });
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { registrationId: REGISTRATION_ID, paymentStatus: PaymentStatus.PAID },
    }));
    expect(storage.read).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('opens payment proof only through the paid registration scope', async () => {
    const stream = Readable.from('proof');
    const prisma = {
      invoice: { findFirst: vi.fn().mockResolvedValue({
        proofStorageKey: STORAGE_KEY,
        proofOriginalName: 'proof.pdf',
        proofMimeType: 'application/pdf',
        proofSize: 5,
      }) },
    };
    const storage = { read: vi.fn().mockResolvedValue({ stream, size: 5 }) };
    const service = new PaidTeamsService(
      prisma as unknown as PrismaService,
      storage as unknown as PrivateStorageService,
    );

    await expect(service.paymentProof(REGISTRATION_ID)).resolves.toEqual({
      stream, originalName: 'proof.pdf', mimeType: 'application/pdf', size: 5,
    });
    expect(storage.read).toHaveBeenCalledWith(STORAGE_KEY);
  });
});
