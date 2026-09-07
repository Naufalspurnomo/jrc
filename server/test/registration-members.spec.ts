import {
  NotFoundException,
} from '@nestjs/common';
import { RegistrationStatus, TeamMemberRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma.service';
import { RegistrationsService } from '../src/registrations';

const OWNER_ID = '048ed71f-fbf0-414a-96d2-9f625847002e';
const REGISTRATION_ID = '18a46e52-63ee-439d-8a77-280f126d82e6';
const MEMBER_ID = '4432cd30-c51d-46c5-9cab-bd786b5abbaa';

function member() {
  return {
    id: MEMBER_ID,
    name: 'Updated Member',
    studentId: null,
    role: TeamMemberRole.LEADER,
    email: 'updated@example.test',
    phone: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-07T00:00:00.000Z'),
  };
}

function serviceWith(transaction: object) {
  const prisma = {
    $transaction: vi.fn(
      (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
  };
  return new RegistrationsService(prisma as unknown as PrismaService);
}

describe('RegistrationsService team member updates', () => {
  it('updates only editable member fields and safely serializes the result', async () => {
    const transaction = {
      registration: {
        findFirst: vi.fn().mockResolvedValue({ status: RegistrationStatus.DRAFT }),
      },
      teamMember: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(member()),
      },
    };
    const service = serviceWith(transaction);

    await expect(service.updateMember(OWNER_ID, REGISTRATION_ID, MEMBER_ID, {
      name: '  Updated Member  ',
      studentId: null,
      email: '  updated@example.test  ',
      phone: '',
    })).resolves.toEqual({
      id: MEMBER_ID,
      name: 'Updated Member',
      studentId: null,
      role: TeamMemberRole.LEADER,
      email: 'updated@example.test',
      phone: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
    });
    expect(transaction.teamMember.updateMany).toHaveBeenCalledWith({
      where: { id: MEMBER_ID, registrationId: REGISTRATION_ID },
      data: {
        name: 'Updated Member',
        studentId: null,
        email: 'updated@example.test',
        phone: null,
      },
    });
    expect(transaction.teamMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: MEMBER_ID, registrationId: REGISTRATION_ID },
    }));
  });

  it('hides registrations not owned by the caller', async () => {
    const transaction = {
      registration: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = serviceWith(transaction);

    await expect(service.updateMember(OWNER_ID, REGISTRATION_ID, MEMBER_ID, {
      name: 'Stolen',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects member updates when the registration is not editable', async () => {
    const transaction = {
      registration: {
        findFirst: vi.fn().mockResolvedValue({ status: RegistrationStatus.SUBMITTED }),
      },
    };
    const service = serviceWith(transaction);

    await expect(service.updateMember(OWNER_ID, REGISTRATION_ID, MEMBER_ID, {
      name: 'Too late',
    })).rejects.toThrow('Registration is not editable in its current status');
  });
});
