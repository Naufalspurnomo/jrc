import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OutboxStatus, Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../src/auth';
import {
  AdminParticipantsController,
  AdminParticipantsService,
} from '../src/admin-participants';

const actorId = '22222222-2222-4222-8222-222222222222';
const participantId = '11111111-1111-4111-8111-111111111111';
const audit = { requestId: 'request-1', ipAddress: '127.0.0.1' };

function participant(overrides: Record<string, unknown> = {}) {
  return {
    id: participantId,
    email: 'owner@example.test',
    displayName: 'Owner',
    role: Role.PARTICIPANT,
    active: true,
    emailVerifiedAt: new Date('2026-09-01T00:00:00.000Z'),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    registrations: [],
    _count: { sessions: 2 },
    ...overrides,
  };
}

function setup(current: ReturnType<typeof participant> | null = participant()) {
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue(current),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    emailOutbox: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
  const prisma = {
    user: { findMany: vi.fn().mockResolvedValue([participant()]) },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => Promise.resolve(callback(tx))),
  };
  return {
    service: new AdminParticipantsService(prisma as never),
    prisma,
    tx,
  };
}

describe('Admin participant management', () => {
  it('restricts list and deletion endpoints to SUPER_ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminParticipantsController)).toEqual([Role.SUPER_ADMIN]);
  });

  it('searches participant identity and returns registration/payment/ticket activity', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([
      participant({
        registrations: [{
          id: 'registration-1',
          registrationNumber: 'JRC-XIV-0001',
          teamName: 'Garuda',
          status: 'APPROVED',
          updatedAt: new Date('2026-09-03T00:00:00.000Z'),
          invoice: { paymentStatus: 'PAID' },
          ticket: { status: 'ACTIVE' },
        }],
      }),
    ]);

    await expect(service.list({ query: ' owner@example.test ' })).resolves.toEqual([
      expect.objectContaining({
        id: participantId,
        registration: expect.objectContaining({
          registrationNumber: 'JRC-XIV-0001',
          paymentStatus: 'PAID',
          ticketStatus: 'ACTIVE',
        }),
        sessionCount: 2,
      }),
    ]);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        role: Role.PARTICIPANT,
        OR: [
          { displayName: { contains: 'owner@example.test', mode: 'insensitive' } },
          { email: { contains: 'owner@example.test', mode: 'insensitive' } },
        ],
      },
    }));
  });

  it('deletes an activity-free participant with a tombstone audit', async () => {
    const { service, tx } = setup();

    await expect(service.delete(actorId, participantId, audit)).resolves.toEqual({ deleted: true });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({
      where: { id: participantId, role: Role.PARTICIPANT, registrations: { none: {} } },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId,
        action: 'PARTICIPANT_ACCOUNT_DELETED',
        entityType: 'User',
        entityId: participantId,
        before: expect.objectContaining({ email: 'owner@example.test' }),
      }),
    });
    expect(tx.emailOutbox.deleteMany).toHaveBeenCalledWith({
      where: {
        to: 'owner@example.test',
        subject: {
          in: [
            'Verifikasi email akun JRC XIV',
            'Reset kata sandi akun JRC XIV',
          ],
        },
        status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
      },
    });
  });

  it('protects the current account and every non-participant account', async () => {
    const { service, tx } = setup();
    await expect(service.delete(participantId, participantId, audit)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.findUnique).not.toHaveBeenCalled();

    tx.user.findUnique.mockResolvedValue(participant({ role: Role.SUPER_ADMIN }));
    await expect(service.delete(actorId, participantId, audit)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ['registration', { invoice: null, ticket: null }],
    ['payment', { invoice: { paymentStatus: 'UNPAID' }, ticket: null }],
    ['ticket', { invoice: null, ticket: { status: 'ACTIVE' } }],
  ])('blocks deletion when participant has %s activity', async (_label, activity) => {
    const { service, tx } = setup(participant({ registrations: [{ id: 'registration-1', ...activity }] }));
    await expect(service.delete(actorId, participantId, audit)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.deleteMany).not.toHaveBeenCalled();
  });

  it('returns not found for an unknown account', async () => {
    const { service, tx } = setup(null);
    await expect(service.delete(actorId, participantId, audit)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.user.deleteMany).not.toHaveBeenCalled();
  });

  it('fails closed if activity appears before the guarded delete', async () => {
    const { service, tx } = setup();
    tx.user.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.delete(actorId, participantId, audit)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
