import { PaymentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../src/auth';
import { PaidTeamsController, PaidTeamsService } from '../src/paid-teams';

const paidInvoice = {
  id: 'invoice-1',
  paymentStatus: PaymentStatus.PAID,
  verifiedAt: new Date('2026-10-05T08:30:00.000Z'),
  registration: {
    registrationNumber: 'JRC-XIV-0015',
    teamName: 'Garuda Robotika',
    institution: 'PENS',
    competition: {
      id: 'competition-1',
      name: 'Charion Line',
      level: 'Umum',
      discipline: 'Line Follower Mikro',
    },
  },
};

describe('Paid team read-only list', () => {
  it('restricts the endpoint to the dedicated paid-team viewer role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PaidTeamsController)).toEqual(['PAID_TEAM_VIEWER']);
  });

  it('queries only paid invoices and returns the minimal team contract', async () => {
    const prisma = {
      invoice: { findMany: vi.fn().mockResolvedValue([paidInvoice]) },
    };
    const service = new PaidTeamsService(prisma as never);

    await expect(service.list({ query: ' garuda ', page: 1, pageSize: 25 })).resolves.toEqual([
      {
        registrationNumber: 'JRC-XIV-0015',
        teamName: 'Garuda Robotika',
        institution: 'PENS',
        competition: paidInvoice.registration.competition,
        verifiedAt: '2026-10-05T08:30:00.000Z',
      },
    ]);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ paymentStatus: PaymentStatus.PAID }),
      skip: 0,
      take: 25,
    }));
    const payload = JSON.stringify(await service.list({}));
    expect(payload).not.toMatch(/invoice-1|proof|amount|verificationReason|owner|phone|email|member/i);
  });
});
