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
    reviewReason: null,
    competition: { id: '943ca4f3-5dbf-4510-b5c7-a3309920d637' },
    _count: { members: 1, documents },
  };
}

describe('RegistrationsService submission requirements', () => {
  it('rejects submission without a document selected in the transaction', async () => {
    const transaction = {
      registration: {
        findFirst: vi.fn().mockResolvedValue(currentRegistration(0)),
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
