import { RegistrationStatus, TeamMemberRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AdminRegistrationsService } from '../src/admin-registrations';
import { PrismaService } from '../src/prisma.service';
import { RegistrationsService } from '../src/registrations';

const OWNER_ID = '048ed71f-fbf0-414a-96d2-9f625847002e';
const REGISTRATION_ID = '18a46e52-63ee-439d-8a77-280f126d82e6';

function serializedMember(role: TeamMemberRole) {
  return {
    id: '4432cd30-c51d-46c5-9cab-bd786b5abbaa',
    name: 'Rina Pembina',
    studentId: null,
    role,
    email: null,
    phone: null,
    createdAt: new Date('2026-09-26T00:00:00.000Z'),
    updatedAt: new Date('2026-09-26T00:00:00.000Z'),
  };
}

describe('registration revision rules', () => {
  it('creates one supervisor outside the three-participant limit', async () => {
    const transaction = {
      registration: {
        findFirst: vi.fn().mockResolvedValue({ status: RegistrationStatus.DRAFT }),
      },
      teamMember: {
        count: vi.fn()
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0),
        create: vi.fn().mockResolvedValue(serializedMember(TeamMemberRole.SUPERVISOR)),
      },
    };
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction)),
    };

    await expect(new RegistrationsService(prisma as unknown as PrismaService).addMember(
      OWNER_ID,
      REGISTRATION_ID,
      { name: 'Rina Pembina', role: TeamMemberRole.SUPERVISOR },
    )).resolves.toMatchObject({ role: TeamMemberRole.SUPERVISOR });
  });

  it('exports one attendance row for every roster role', async () => {
    const prisma = {
      registration: {
        findMany: vi.fn().mockResolvedValue([{
          registrationNumber: 'JRC14-2026-0001',
          teamName: '=Garuda',
          institution: 'PENS',
          competition: { name: 'Sumo' },
          ticket: { kitHandedOverAt: new Date('2026-09-23T10:02:00.000Z'), kitHandedOverBy: { displayName: 'Kit Operator' } },
          members: [
            { role: TeamMemberRole.LEADER, name: 'Ari', studentId: 'NRP-1', attendedAt: new Date('2026-09-23T10:01:00.000Z'), attendedBy: { displayName: 'Gate Operator' } },
            { role: TeamMemberRole.MEMBER, name: 'Bima', studentId: 'NRP-2', attendedAt: null, attendedBy: null },
            { role: TeamMemberRole.SUPERVISOR, name: 'Rina', studentId: null, attendedAt: null, attendedBy: null },
          ],
        }]),
      },
    };
    const service = new AdminRegistrationsService(
      prisma as unknown as PrismaService,
      {} as never,
    );

    const csv = await service.exportAttendanceCsv({});

    expect(csv).toContain("'=Garuda");
    expect(csv).toContain('LEADER,Ari,NRP-1,ATTENDED,2026-09-23T10:01:00.000Z,Gate Operator,HANDED_OVER,2026-09-23T10:02:00.000Z,Kit Operator');
    expect(csv).toContain('MEMBER,Bima,NRP-2,NOT_ATTENDED,,,HANDED_OVER,2026-09-23T10:02:00.000Z,Kit Operator');
    expect(csv).toContain('SUPERVISOR,Rina,,NOT_ATTENDED,,,HANDED_OVER,2026-09-23T10:02:00.000Z,Kit Operator');
    expect(prisma.registration.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        members: expect.not.objectContaining({ where: expect.anything() }),
      }),
    }));
  });
});
