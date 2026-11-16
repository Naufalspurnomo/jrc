import { RegistrationStatus, TeamMemberRole } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GoogleSheetsPublisher,
  GoogleSheetsSyncService,
  shouldQueueGoogleSheetsSync,
} from '../src/google-sheets-sync';
import { PrismaService } from '../src/prisma.service';

const previousEnv = { ...process.env };

afterEach(() => {
  process.env = { ...previousEnv };
  vi.restoreAllMocks();
});

describe('GoogleSheetsSyncService', () => {
  it('publishes current registration and attendance snapshots with formula-safe cells', async () => {
    process.env.GOOGLE_SHEETS_ENABLED = 'true';
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'sheet-123';
    const prisma = {
      registration: {
        findMany: vi.fn().mockResolvedValue([{ 
          registrationNumber: '+JRC14-2026-0001',
          teamName: '=Garuda',
          institution: '@PENS',
          phone: '-0812',
          status: RegistrationStatus.APPROVED,
          submittedAt: new Date('2026-09-20T08:00:00.000Z'),
          reviewedAt: new Date('2026-09-21T08:00:00.000Z'),
          updatedAt: new Date('2026-09-24T08:30:00.000Z'),
          owner: { displayName: 'Ari', email: 'ari@example.test' },
          competition: { name: 'Sumo' },
          invoice: { paymentStatus: 'PAID' },
          ticket: {
            kitHandedOverAt: new Date('2026-09-23T10:02:00.000Z'),
            kitHandedOverBy: { displayName: 'Kit Operator' },
          },
          members: [{
            role: TeamMemberRole.LEADER,
            name: 'Ari',
            studentId: 'NRP-1',
            attendedAt: new Date('2026-09-23T10:01:00.000Z'),
            attendedBy: { displayName: 'Gate Operator' },
          }],
        }]),
      },
    };
    const publisher: GoogleSheetsPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    const service = new GoogleSheetsSyncService(
      prisma as unknown as PrismaService,
      publisher,
    );

    await expect(service.synchronize()).resolves.toMatchObject({
      enabled: true,
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      registrationCount: 1,
      attendanceCount: 1,
      lastSyncedAt: expect.any(String),
    });

    expect(publisher.publish).toHaveBeenCalledOnce();
    const [snapshot] = vi.mocked(publisher.publish).mock.calls[0];
    expect(snapshot.registrations[0]).toContain('Registration Number');
    expect(snapshot.registrations[1]).toEqual(expect.arrayContaining([
      "'+JRC14-2026-0001",
      "'=Garuda",
      "'@PENS",
      "'-0812",
      'PAID',
    ]));
    expect(snapshot.attendance[1]).toEqual(expect.arrayContaining([
      "'+JRC14-2026-0001",
      "'=Garuda",
      'ATTENDED',
      'HANDED_OVER',
    ]));
  });

  it('reports disabled without querying production data', async () => {
    process.env.GOOGLE_SHEETS_ENABLED = 'false';
    const prisma = { registration: { findMany: vi.fn() } };
    const publisher: GoogleSheetsPublisher = { publish: vi.fn() };
    const service = new GoogleSheetsSyncService(
      prisma as unknown as PrismaService,
      publisher,
    );

    await expect(service.synchronize()).resolves.toEqual({
      enabled: false,
      spreadsheetUrl: null,
      syncing: false,
      lastSyncedAt: null,
      lastError: null,
    });
    expect(prisma.registration.findMany).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});

describe('shouldQueueGoogleSheetsSync', () => {
  it.each([
    ['POST', '/api/registrations'],
    ['PATCH', '/api/registrations/registration-id'],
    ['DELETE', '/api/admin/registrations/registration-id'],
    ['DELETE', '/api/admin/participants/participant-id'],
    ['POST', '/api/admin/invoices/invoice-id/verify'],
    ['POST', '/api/invoices/invoice-id/proof'],
    ['POST', '/api/gate/redeem'],
    ['POST', '/api/gate/kit'],
  ])('queues %s %s', (method, path) => {
    expect(shouldQueueGoogleSheetsSync(method, path)).toBe(true);
  });

  it.each([
    ['GET', '/api/registrations'],
    ['POST', '/api/auth/login'],
    ['POST', '/api/admin/google-sheets/sync'],
  ])('ignores %s %s', (method, path) => {
    expect(shouldQueueGoogleSheetsSync(method, path)).toBe(false);
  });
});
