import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RegistrationStatus, Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../src/auth';
import {
  AdminEditRegistrationDto,
  AdminRegistrationsController,
  AdminRegistrationsService,
} from '../src/admin-registrations';

const id = '11111111-1111-4111-8111-111111111111';
const memberId = '33333333-3333-4333-8333-333333333333';
const actorId = '22222222-2222-4222-8222-222222222222';
const audit = { requestId: 'request-edit-1', ipAddress: '127.0.0.1' };

function member(name = 'Ketua Lama') {
  return {
    id: memberId,
    name,
    studentId: 'NISN-LAMA',
    role: 'LEADER' as const,
    email: 'lama@example.test',
    phone: '081234567890',
    createdAt: new Date('2026-11-24T00:00:00.000Z'),
    updatedAt: new Date('2026-11-24T00:00:00.000Z'),
  };
}

function registration(currentMember = member()) {
  return {
    id,
    registrationNumber: 'JRC-XIV-0001',
    competitionId: '44444444-4444-4444-8444-444444444444',
    teamName: 'Tim Lama',
    institution: 'Institusi Lama',
    phone: '081111111111',
    status: RegistrationStatus.APPROVED,
    reviewReasonCategory: null,
    reviewReasonComment: null,
    submittedAt: new Date('2026-11-20T00:00:00.000Z'),
    reviewedAt: new Date('2026-11-21T00:00:00.000Z'),
    createdAt: new Date('2026-11-19T00:00:00.000Z'),
    updatedAt: new Date('2026-11-21T00:00:00.000Z'),
    owner: { id: 'owner-1', email: 'owner@example.test', displayName: 'Owner' },
    competition: {
      id: '44444444-4444-4444-8444-444444444444',
      slug: 'sumo',
      name: 'Ring Rumble — Sumo',
      level: 'SMA',
      discipline: 'SUMO',
      description: 'Competition',
      eventId: 'jrc-xiv',
      eventName: 'JRC XIV',
      fee: 100000,
      currency: 'IDR',
      registrationDeadline: new Date('2026-11-30T16:59:59.000Z'),
    },
    members: [currentMember],
    documents: [],
    invoice: {
      id: 'invoice-1',
      invoiceNumber: 'JRC-INV-2026-1',
      amount: 100000,
      currency: 'IDR',
      provider: 'MANUAL',
      instructions: { bankName: 'Bank Test' },
      paymentStatus: 'PAID' as const,
      deadline: new Date('2026-11-25T00:00:00.000Z'),
      proofOriginalName: null,
      proofMimeType: null,
      proofSize: null,
      verificationReason: null,
      verifiedAt: new Date('2026-11-22T00:00:00.000Z'),
      createdAt: new Date('2026-11-21T00:00:00.000Z'),
      updatedAt: new Date('2026-11-22T00:00:00.000Z'),
    },
    ticket: { status: 'ACTIVE' as const },
  };
}

function setup(current = registration(), updated = registration()) {
  const tx = {
    registration: {
      findUnique: vi.fn()
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(updated),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    teamMember: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => Promise.resolve(callback(tx))),
  };
  const service = new AdminRegistrationsService(prisma as never, {} as never);
  return { service, prisma, tx };
}

describe('Admin registration data editing', () => {
  it('allows reviewer and support roles to use the edit endpoint', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminRegistrationsController.prototype.editRegistration))
      .toEqual([Role.REGISTRATION_REVIEWER, Role.SUPPORT]);
  });

  it('edits participant-submitted fields while preserving paid and ticket state in the audit', async () => {
    const updatedMember = member('Ketua Benar');
    const updated = registration(updatedMember);
    updated.teamName = 'Tim Benar';
    updated.institution = 'Institusi Benar';
    updated.phone = '082222222222';
    const { service, tx } = setup(registration(), updated);
    const dto = Object.assign(new AdminEditRegistrationDto(), {
      teamName: 'Tim Benar',
      institution: 'Institusi Benar',
      phone: '082222222222',
      members: [{ id: memberId, role: 'LEADER', name: 'Ketua Benar', studentId: 'NISN-BENAR', email: 'benar@example.test', phone: '082222222222' }],
    });

    const result = await service.edit(actorId, id, dto, audit);

    expect(result.teamName).toBe('Tim Benar');
    expect(tx.registration.updateMany).toHaveBeenCalledOnce();
    expect(tx.teamMember.updateMany).toHaveBeenCalledWith({
      where: { id: memberId, registrationId: id },
      data: {
        role: 'LEADER',
        name: 'Ketua Benar',
        studentId: 'NISN-BENAR',
        email: 'benar@example.test',
        phone: '082222222222',
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'REGISTRATION_DATA_EDITED',
        before: expect.objectContaining({
          payment: expect.objectContaining({ id: 'invoice-1', paymentStatus: 'PAID' }),
          ticket: expect.objectContaining({ status: 'ACTIVE' }),
        }),
        after: expect.objectContaining({
          payment: expect.objectContaining({ id: 'invoice-1', paymentStatus: 'PAID' }),
          ticket: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      }),
    });
  });

  it('rejects an empty edit and an unrelated member without writing', async () => {
    const { service, tx } = setup();
    await expect(service.edit(actorId, id, new AdminEditRegistrationDto(), audit))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.edit(actorId, id, Object.assign(new AdminEditRegistrationDto(), {
      members: [{ id: '55555555-5555-4555-8555-555555555555', name: 'Wrong' }],
    }), audit)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.registration.updateMany).not.toHaveBeenCalled();
    expect(tx.teamMember.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
