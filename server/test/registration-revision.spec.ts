import { RegistrationStatus, TeamMemberRole } from '@prisma/client';
import ExcelJS from 'exceljs';
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
  it('exports styled native registration workbook with typed values', async () => {
    const prisma = {
      registration: {
        findMany: vi.fn().mockResolvedValue([{
          registrationNumber: '+JRC14-2026-0001',
          teamName: '@Garuda',
          institution: '\tPENS',
          status: RegistrationStatus.APPROVED,
          updatedAt: new Date('2026-09-24T08:30:00.000Z'),
          competition: { name: '-Sumo' },
          _count: { members: 4 },
        }]),
      },
    };
    const service = new AdminRegistrationsService(
      prisma as unknown as PrismaService,
      {} as never,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await service.exportXlsx({}) as never);
    const sheet = workbook.getWorksheet('Registrations');

    expect(workbook.creator).toBe('JRC XIV Administration');
    expect(sheet!.getRow(1).values).toEqual([
      undefined, 'Registration Number', 'Team', 'Institution', 'Competition',
      'Status', 'Member Count', 'Updated At',
    ]);
    expect(sheet!.views).toContainEqual(expect.objectContaining({ state: 'frozen', ySplit: 1 }));
    expect(sheet!.autoFilter).toBe('A1:G2');
    expect(sheet!.getCell('A2').value).toBe("'+JRC14-2026-0001");
    expect(sheet!.getCell('B2').value).toBe("'@Garuda");
    expect(sheet!.getCell('C2').value).toBe("'\tPENS");
    expect(sheet!.getCell('D2').value).toBe("'-Sumo");
    expect(sheet!.getCell('F2').value).toBe(4);
    expect(sheet!.getCell('G2').value).toEqual(new Date('2026-09-24T08:30:00.000Z'));
    expect(sheet!.getCell('G2').numFmt).toBe('yyyy-mm-dd hh:mm:ss');
  });

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

    const buffer = await service.exportAttendanceXlsx({});
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet('Attendance');

    expect(sheet).toBeDefined();
    expect(sheet!.views).toContainEqual(expect.objectContaining({ state: 'frozen', ySplit: 1 }));
    expect(sheet!.autoFilter).toBe('A1:M4');
    expect(sheet!.getRow(1).values).toEqual([
      undefined, 'Registration Number', 'Team', 'Competition', 'Institution', 'Role',
      'Member Name', 'Student ID', 'Attendance Status', 'Attended At',
      'Attendance Operator', 'JRC Kit Status', 'Kit Handed Over At', 'Kit Operator',
    ]);
    expect(sheet!.getCell('B2').value).toBe("'=Garuda");
    expect(sheet!.getCell('H2').value).toBe('ATTENDED');
    expect(sheet!.getCell('I2').value).toEqual(new Date('2026-09-23T10:01:00.000Z'));
    expect(sheet!.getCell('I2').numFmt).toBe('yyyy-mm-dd hh:mm:ss');
    expect(sheet!.getCell('K2').value).toBe('HANDED_OVER');
    expect(sheet!.getCell('L2').value).toEqual(new Date('2026-09-23T10:02:00.000Z'));
    expect(sheet!.getCell('E4').value).toBe('SUPERVISOR');
    expect(sheet!.getCell('F4').value).toBe('Rina');
    expect(prisma.registration.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        members: expect.not.objectContaining({ where: expect.anything() }),
      }),
    }));
  });
});
