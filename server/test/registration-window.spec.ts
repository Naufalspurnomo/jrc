import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RegistrationStatus, TeamMemberRole } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma.service';
import { RegistrationsService } from '../src/registrations';

const OWNER_ID = '048ed71f-fbf0-414a-96d2-9f625847002e';
const REGISTRATION_ID = '18a46e52-63ee-439d-8a77-280f126d82e6';
const COMPETITION_ID = '943ca4f3-5dbf-4510-b5c7-a3309920d637';
const OPEN_AT = new Date('2026-09-30T01:00:00.000Z'); // 08:00 WIB
const DEADLINE = new Date('2026-11-21T16:59:59.000Z');
const AUDIT = { requestId: 'request-id', ipAddress: '127.0.0.1' };
const BASE_DOCUMENTS = [
  'IDENTITY_CARD',
  'REGISTRATION_FORM',
  'TEAM_PHOTO',
  'TWIBBON_PROOF',
].map((category) => ({ category, subjectName: null, subjectRole: null }));

function currentRegistration(level = 'SMA', documents = BASE_DOCUMENTS) {
  return {
    status: RegistrationStatus.DRAFT,
    teamName: 'Team One',
    institution: 'PENS',
    competitionId: COMPETITION_ID,
    submittedAt: null,
    registrationNumber: 'JRC14-2026-0001',
    reviewReasonCategory: null,
    reviewReasonComment: null,
    owner: { email: 'owner@example.test', displayName: 'Owner' },
    competition: {
      id: COMPETITION_ID,
      name: 'Sumo',
      level,
      registrationOpenAt: OPEN_AT,
      registrationDeadline: DEADLINE,
    },
    members: [
      { name: 'Leader One', role: TeamMemberRole.LEADER },
      { name: 'Supervisor One', role: TeamMemberRole.SUPERVISOR },
    ],
    documents,
  };
}

function submissionService(current = currentRegistration()) {
  const transaction = {
    registration: { findFirst: vi.fn().mockResolvedValue(current) },
    user: { findUnique: vi.fn().mockResolvedValue({ emailVerifiedAt: new Date() }) },
  };
  const prisma = {
    $transaction: vi.fn((operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction)),
  };
  return { service: new RegistrationsService(prisma as unknown as PrismaService), transaction };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('registration submission window', () => {
  it('rejects submission before opening with a structured error body', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(OPEN_AT.getTime() - 1));
    const { service } = submissionService();

    const error = await service.submit(OWNER_ID, REGISTRATION_ID, AUDIT).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toEqual({
      code: 'REGISTRATION_NOT_OPEN',
      message: 'Registration submission is not open yet',
    });
  });

  it('allows the opening instant to reach document validation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(OPEN_AT);
    const { service } = submissionService();

    await expect(service.submit(OWNER_ID, REGISTRATION_ID, AUDIT)).rejects.toThrow(
      'All required document categories must be uploaded before submission',
    );
  });

  it('rejects submission at the deadline instant with a structured error body', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DEADLINE);
    const { service } = submissionService();

    const error = await service.submit(OWNER_ID, REGISTRATION_ID, AUDIT).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toEqual({
      code: 'REGISTRATION_CLOSED',
      message: 'Registration is closed',
    });
  });
});

describe('registration document policy', () => {
  it.each(['SD', 'SMP', 'SMA'])('requires a recommendation letter for %s', async (level) => {
    vi.useFakeTimers();
    vi.setSystemTime(OPEN_AT);
    const { service } = submissionService(currentRegistration(level));

    await expect(service.submit(OWNER_ID, REGISTRATION_ID, AUDIT)).rejects.toThrow(
      'All required document categories must be uploaded before submission',
    );
  });

  it.each(['Umum', 'FutureLevel'])('does not require a recommendation letter for %s', async (level) => {
    vi.useFakeTimers();
    vi.setSystemTime(OPEN_AT);
    const { service } = submissionService(currentRegistration(level));

    await expect(service.submit(OWNER_ID, REGISTRATION_ID, AUDIT)).rejects.toThrow(
      'Formal member photos are required for: Leader One, Supervisor One',
    );
  });

  it('keeps every other required document mandatory', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(OPEN_AT);
    const documents = [
      { category: 'RECOMMENDATION_LETTER', subjectName: null, subjectRole: null },
      ...BASE_DOCUMENTS.filter((document) => document.category !== 'TWIBBON_PROOF'),
    ];
    const { service } = submissionService(currentRegistration('SMA', documents));

    await expect(service.submit(OWNER_ID, REGISTRATION_ID, AUDIT)).rejects.toThrow(
      'All required document categories must be uploaded before submission',
    );
  });
});

describe('draft competition selection window', () => {
  it('allows draft creation before opening while still checking active status and deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(OPEN_AT.getTime() - 1));
    const prisma = {
      competition: { findFirst: vi.fn().mockResolvedValue({ id: COMPETITION_ID }) },
      registration: { findUnique: vi.fn().mockResolvedValue({ id: REGISTRATION_ID }) },
    };
    const service = new RegistrationsService(prisma as unknown as PrismaService);

    await expect(service.create(OWNER_ID, { competitionId: COMPETITION_ID })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.competition.findFirst).toHaveBeenCalledWith({
      where: {
        id: COMPETITION_ID,
        active: true,
        registrationDeadline: { gt: new Date(OPEN_AT.getTime() - 1) },
      },
      select: { id: true },
    });
  });
});
