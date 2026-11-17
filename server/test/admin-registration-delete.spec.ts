import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RegistrationStatus, Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../src/auth';
import {
  AdminRegistrationsController,
  AdminRegistrationsService,
} from '../src/admin-registrations';
import { PrivateStorageService } from '../src/private-storage';

const id = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const audit = { requestId: 'request-1', ipAddress: '127.0.0.1' };

function record(status: RegistrationStatus = RegistrationStatus.DRAFT) {
  return {
    id,
    registrationNumber: 'JRC-XIV-0001',
    teamName: 'Test Team',
    status,
    owner: { id: 'owner-1', email: 'owner@example.test', displayName: 'Owner' },
    documents: [{ storageKey: 'a'.repeat(64) }, { storageKey: 'b'.repeat(64) }],
    invoice: null,
    ticket: null,
  };
}

function setup(current = record()) {
  const tx = {
    registration: {
      findUnique: vi.fn().mockResolvedValue(current),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => Promise.resolve(callback(tx))),
  };
  const storage = { delete: vi.fn().mockResolvedValue(undefined) };
  const service = new AdminRegistrationsService(
    prisma as never,
    {} as never,
    storage as unknown as PrivateStorageService,
  );
  return { service, prisma, storage, tx };
}

describe('Admin registration deletion', () => {
  it('restricts the DELETE endpoint to super admins', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        AdminRegistrationsController.prototype.deleteRegistration,
      ),
    ).toEqual([Role.SUPER_ADMIN]);
  });

  it.each([
    RegistrationStatus.DRAFT,
    RegistrationStatus.SUBMITTED,
    RegistrationStatus.UNDER_REVIEW,
    RegistrationStatus.REVISION_REQUESTED,
    RegistrationStatus.REJECTED,
    RegistrationStatus.CANCELLED,
  ])('deletes an eligible %s registration and creates a tombstone audit', async (status) => {
    const { service, storage, tx } = setup(record(status));

    const result = await service.delete(actorId, id, audit);

    expect(tx.registration.deleteMany).toHaveBeenCalledWith({
      where: { id, status, invoice: null, ticket: null },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId,
        action: 'REGISTRATION_DELETED',
        entityType: 'Registration',
        entityId: id,
        before: expect.objectContaining({
          registrationNumber: 'JRC-XIV-0001',
          teamName: 'Test Team',
          status,
          owner: expect.objectContaining({ email: 'owner@example.test' }),
          documentStorageKeys: ['a'.repeat(64), 'b'.repeat(64)],
        }),
      }),
    });
    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ deleted: true, cleanupWarnings: [] });
  });

  it.each([
    ['approved', record(RegistrationStatus.APPROVED)],
    ['invoice', { ...record(), invoice: { id: 'invoice-1' } }],
    ['ticket', { ...record(), ticket: { id: 'ticket-1' } }],
  ])('refuses deletion when the registration has %s protection', async (_label, current) => {
    const { service, tx, storage } = setup(current as ReturnType<typeof record>);

    await expect(service.delete(actorId, id, audit)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.registration.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('returns not found without deleting unrelated records', async () => {
    const { service, tx } = setup(null as never);
    await expect(service.delete(actorId, id, audit)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.registration.deleteMany).not.toHaveBeenCalled();
  });

  it('rolls back when a concurrent change makes the guarded delete lose the race', async () => {
    const { service, tx, storage } = setup();
    tx.registration.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.delete(actorId, id, audit)).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('commits deletion and reports opaque cleanup warnings when storage cleanup fails', async () => {
    const { service, storage } = setup();
    storage.delete.mockRejectedValueOnce(new Error(`failed ${'a'.repeat(64)}`));

    await expect(service.delete(actorId, id, audit)).resolves.toEqual({
      deleted: true,
      cleanupWarnings: ['Satu berkas privat gagal dibersihkan.'],
    });
  });
});
