import { BadRequestException, type HttpException } from '@nestjs/common';
import { Prisma, RegistrationStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../src/prisma.service';
import { RegistrationsService } from '../src/registrations';

const OWNER_ID = '048ed71f-fbf0-414a-96d2-9f625847002e';
const FIRST_COMPETITION_ID = '943ca4f3-5dbf-4510-b5c7-a3309920d637';
const SECOND_COMPETITION_ID = '0edb804c-9254-43d8-a7a6-0a2411706aa1';

function registrationFixture(competitionId = SECOND_COMPETITION_ID) {
  const now = new Date('2026-11-19T00:00:00.000Z');
  return {
    id: '18a46e52-63ee-439d-8a77-280f126d82e6',
    registrationNumber: 'JRC14-2026-0002',
    ownerId: OWNER_ID,
    competitionId,
    teamName: '',
    institution: '',
    phone: null,
    status: RegistrationStatus.DRAFT,
    reviewReasonCategory: null,
    reviewReasonComment: null,
    submittedAt: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
    competition: {
      id: competitionId,
      slug: 'second-competition',
      name: 'Second Competition',
      level: 'Umum',
      discipline: 'Second Discipline',
      description: null,
      eventId: 'event-1',
      eventName: 'JRC XIV',
      fee: 100_000,
      currency: 'IDR',
      registrationOpenAt: now,
      registrationDeadline: new Date('2026-11-21T16:59:59.000Z'),
    },
    members: [],
    documents: [],
    invoice: null,
    ticket: null,
  };
}

function createService(options: { count: number; duplicateCompetition?: boolean }) {
  const transaction = {
    registration: {
      count: vi.fn().mockResolvedValue(options.count),
      findFirst: vi.fn().mockResolvedValue(
        options.duplicateCompetition ? { id: 'existing-registration' } : null,
      ),
      create: vi.fn().mockResolvedValue(registrationFixture()),
    },
  };
  const prisma = {
    competition: {
      findFirst: vi.fn().mockResolvedValue({ id: SECOND_COMPETITION_ID }),
    },
    registration: {
      findUnique: vi.fn().mockResolvedValue(
        options.count > 0 ? { id: 'existing-registration' } : null,
      ),
    },
    $transaction: vi.fn(
      async (operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction),
    ),
  };
  return {
    service: new RegistrationsService(prisma as unknown as PrismaService),
    prisma,
    transaction,
  };
}

async function rejectedResponse(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(BadRequestException);
  return (error as HttpException).getResponse();
}

describe('participant registration account policy', () => {
  it('retries a serialization conflict and rechecks the concurrent winner', async () => {
    const { service, prisma, transaction } = createService({ count: 1 });
    prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: '6.19.2' }));
    transaction.registration.count.mockResolvedValue(5);
    await expect(rejectedResponse(service.create(OWNER_ID, { competitionId: SECOND_COMPETITION_ID }))).resolves.toMatchObject({ code: 'REGISTRATION_LIMIT_REACHED' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transaction.registration.create).not.toHaveBeenCalled();
  });

  it('maps PostgreSQL trigger errors returned as UnknownRequestError', async () => {
    const { service, transaction } = createService({ count: 1 });
    transaction.registration.create.mockRejectedValueOnce(new Prisma.PrismaClientUnknownRequestError('constraint registrations_owner_max_five violated', { clientVersion: '6.19.2' }));
    await expect(rejectedResponse(service.create(OWNER_ID, { competitionId: SECOND_COMPETITION_ID }))).resolves.toMatchObject({ code: 'REGISTRATION_LIMIT_REACHED' });
  });

  it('does not mask unrelated database errors', async () => {
    const { service, transaction } = createService({ count: 1 });
    const error = new Prisma.PrismaClientUnknownRequestError('connection lost', { clientVersion: '6.19.2' });
    transaction.registration.create.mockRejectedValueOnce(error);
    await expect(service.create(OWNER_ID, { competitionId: SECOND_COMPETITION_ID })).rejects.toBe(error);
  });
  it('allows a second team when it uses a different competition', async () => {
    const { service, prisma, transaction } = createService({ count: 1 });

    await expect(
      service.create(OWNER_ID, { competitionId: SECOND_COMPETITION_ID }),
    ).resolves.toMatchObject({
      competitionId: SECOND_COMPETITION_ID,
      status: RegistrationStatus.DRAFT,
    });

    expect(transaction.registration.create).toHaveBeenCalledOnce();
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it('allows another team in a competition already used by the account', async () => {
    const { service, transaction } = createService({ count: 1, duplicateCompetition: true });

    await expect(service.create(OWNER_ID, { competitionId: SECOND_COMPETITION_ID })).resolves.toMatchObject({
      competitionId: SECOND_COMPETITION_ID,
      status: RegistrationStatus.DRAFT,
    });
    expect(transaction.registration.create).toHaveBeenCalledOnce();
  });

  it('allows five teams per account', async () => {
    const { service, transaction } = createService({ count: 4 });
    await expect(service.create(OWNER_ID, { competitionId: FIRST_COMPETITION_ID })).resolves.toMatchObject({
      status: RegistrationStatus.DRAFT,
    });
    expect(transaction.registration.create).toHaveBeenCalledOnce();
  });

  it('rejects a sixth team', async () => {
    const { service, transaction } = createService({ count: 5 });
    await expect(rejectedResponse(service.create(OWNER_ID, { competitionId: FIRST_COMPETITION_ID }))).resolves.toEqual({
      code: 'REGISTRATION_LIMIT_REACHED',
      message: 'Satu akun hanya dapat mendaftarkan maksimal lima tim',
    });
    expect(transaction.registration.create).not.toHaveBeenCalled();
  });
});
