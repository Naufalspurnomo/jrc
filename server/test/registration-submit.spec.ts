import { RegistrationStatus, TeamMemberRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma.service';
import { RegistrationsService } from '../src/registrations';

const OWNER_ID = '048ed71f-fbf0-414a-96d2-9f625847002e';
const REGISTRATION_ID = '18a46e52-63ee-439d-8a77-280f126d82e6';
const AUDIT = { requestId: 'request-id', ipAddress: '127.0.0.1' };

function currentRegistration(documents: number) {
  return {
    status: RegistrationStatus.DRAFT,
    teamName: 'Team One',
    institution: 'PENS',
    competitionId: '943ca4f3-5dbf-4510-b5c7-a3309920d637',
    submittedAt: null,
    registrationNumber: 'JRC14-2026-0001',
    reviewReasonCategory: null,
    reviewReasonComment: null,
    owner: { email: 'owner@example.test', displayName: 'Owner' },
    competition: { id: '943ca4f3-5dbf-4510-b5c7-a3309920d637', name: 'Sumo' },
    _count: { members: 1, documents },
  };
}

describe('RegistrationsService submission requirements', () => {
  it('atomically enqueues an encrypted submission acknowledgement', async () => {
    process.env.TICKET_SECRET = 'test-ticket-secret-with-at-least-32-characters';
    const returned = {
      id: REGISTRATION_ID,
      registrationNumber: 'JRC14-2026-0001',
      competitionId: '943ca4f3-5dbf-4510-b5c7-a3309920d637',
      teamName: 'Team One', institution: 'PENS', phone: null,
      status: RegistrationStatus.SUBMITTED, reviewReasonCategory: null,
      reviewReasonComment: null, submittedAt: new Date(), reviewedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
      competition: { id: '943ca4f3-5dbf-4510-b5c7-a3309920d637', slug: 'sumo', name: 'Sumo', level: 'College', discipline: 'Robot', description: null, eventId: 'event', eventName: 'JRC', fee: 100, currency: 'IDR', registrationDeadline: new Date() },
      members: [], documents: [], invoice: null, ticket: null,
    };
    const transaction = {
      registration: { findFirst: vi.fn().mockResolvedValue(currentRegistration(1)), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue(returned) },
      user: { findUnique: vi.fn().mockResolvedValue({ emailVerifiedAt: new Date(), email: 'owner@example.test', displayName: 'Owner' }) },
      teamMember: { count: vi.fn().mockResolvedValue(1) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      emailOutbox: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction)) };
    await new RegistrationsService(prisma as unknown as PrismaService).submit(OWNER_ID, REGISTRATION_ID, AUDIT);
    const email = transaction.emailOutbox.create.mock.calls[0]?.[0].data;
    expect(email.to).toBe('owner@example.test');
    expect(email.body).toMatch(/^jrc-email-v1\./);
    expect(email.body).not.toContain('awaiting review');
  });
  it('includes cleared review category and comment in the resubmission audit snapshot', async () => {
    process.env.TICKET_SECRET = 'test-ticket-secret-with-at-least-32-characters';
    const current = { ...currentRegistration(1), status: RegistrationStatus.REVISION_REQUESTED, reviewReasonCategory: 'DATA_MISMATCH', reviewReasonComment: 'Fix ID' };
    const returned = { id: REGISTRATION_ID, registrationNumber: current.registrationNumber, competitionId: current.competitionId, teamName: current.teamName, institution: current.institution, phone: null, status: RegistrationStatus.SUBMITTED, reviewReasonCategory: null, reviewReasonComment: null, submittedAt: new Date(), reviewedAt: null, createdAt: new Date(), updatedAt: new Date(), competition: { id: current.competitionId, slug: 'sumo', name: 'Sumo', level: 'College', discipline: 'Robot', description: null, eventId: 'event', eventName: 'JRC', fee: 100, currency: 'IDR', registrationDeadline: new Date() }, members: [], documents: [], invoice: null, ticket: null };
    const transaction = { registration: { findFirst: vi.fn().mockResolvedValue(current), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue(returned) }, user: { findUnique: vi.fn().mockResolvedValue({ emailVerifiedAt: new Date() }) }, teamMember: { count: vi.fn().mockResolvedValue(1) }, auditLog: { create: vi.fn().mockResolvedValue({}) }, emailOutbox: { create: vi.fn().mockResolvedValue({}) } };
    const prisma = { $transaction: vi.fn((operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction)) };
    await new RegistrationsService(prisma as unknown as PrismaService).submit(OWNER_ID, REGISTRATION_ID, AUDIT);
    expect(transaction.registration.findFirst).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ reviewReasonCategory: true }) }));
    expect(transaction.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ before: expect.objectContaining({ reviewReasonCategory: 'DATA_MISMATCH', reviewReasonComment: 'Fix ID' }), after: expect.objectContaining({ reviewReasonCategory: null, reviewReasonComment: null }), reason: 'DATA_MISMATCH: Fix ID' }) });
  });
  it('rejects submission when the owner email is not verified', async () => {
    const transaction = {
      registration: {
        findFirst: vi.fn().mockResolvedValue(currentRegistration(1)),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ emailVerifiedAt: null }) },
    };
    const prisma = {
      $transaction: vi.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };
    const service = new RegistrationsService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.submit(OWNER_ID, REGISTRATION_ID, AUDIT),
    ).rejects.toThrow(
      'Verify your email address before submitting a registration',
    );
  });

  it('rejects submission without a document selected in the transaction', async () => {
    const transaction = {
      registration: {
        findFirst: vi.fn().mockResolvedValue(currentRegistration(0)),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ emailVerifiedAt: new Date() }),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };
    const service = new RegistrationsService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.submit(OWNER_ID, REGISTRATION_ID, AUDIT),
    ).rejects.toThrow('At least one document is required before submission');
    expect(transaction.registration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: { select: { members: true, documents: true } },
        }),
      }),
    );
  });

  it.each([0, 2])(
    'rejects submission when the registration has %i team leaders',
    async (leaderCount) => {
      const transaction = {
        registration: {
          findFirst: vi.fn().mockResolvedValue(currentRegistration(1)),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({ emailVerifiedAt: new Date() }),
        },
        teamMember: { count: vi.fn().mockResolvedValue(leaderCount) },
      };
      const prisma = {
        $transaction: vi.fn(
          (operation: (client: typeof transaction) => Promise<unknown>) =>
            operation(transaction),
        ),
      };
      const service = new RegistrationsService(
        prisma as unknown as PrismaService,
      );

      await expect(
        service.submit(OWNER_ID, REGISTRATION_ID, AUDIT),
      ).rejects.toThrow(
        'Exactly one team leader is required before submission',
      );
      expect(transaction.teamMember.count).toHaveBeenCalledWith({
        where: {
          registrationId: REGISTRATION_ID,
          role: TeamMemberRole.LEADER,
        },
      });
    },
  );
});
