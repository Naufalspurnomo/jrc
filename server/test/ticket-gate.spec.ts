import { PaymentStatus, TicketStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { TicketGateService } from '../src/ticket-gate';
import { PrismaService } from '../src/prisma.service';

const token = 'A'.repeat(43);
const checkedInAt = new Date('2026-09-23T10:00:00.000Z');
const ticket = {
  id: 'ticket', status: TicketStatus.CHECKED_IN, checkedInAt, checkedInById: 'operator-1',
  checkedInBy: { displayName: 'Gate Operator' },
  registration: { registrationNumber: 'JRC-1', teamName: 'Team', institution: 'PENS', competition: { name: 'Sumo', eventId: 'event', eventName: 'JRC' }, invoice: { paymentStatus: PaymentStatus.PAID }, members: [] },
};

describe('TicketGateService checked-in metadata', () => {
  it('returns the successful redemption with current operator metadata and its original timestamp', async () => {
    const activeTicket = {
      ...ticket,
      status: TicketStatus.ACTIVE,
      checkedInAt: null,
      checkedInById: null,
      checkedInBy: null,
    };
    const transaction = {
      ticket: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(activeTicket)
          .mockResolvedValueOnce(ticket),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    };

    const result = await new TicketGateService(
      prisma as unknown as PrismaService,
    ).redeem('operator-1', { token, eventId: 'event' }, {
      requestId: 'request',
      ipAddress: null,
    });

    expect(result).toMatchObject({
      result: 'CHECKED_IN',
      checkedInAt: checkedInAt.toISOString(),
      checkedInBy: { id: 'operator-1', displayName: 'Gate Operator' },
    });
    expect(transaction.ticket.findUnique).toHaveBeenCalledTimes(2);
  });

  it('returns original check-in metadata to authenticated gate inspection', async () => {
    const prisma = { ticket: { findUnique: vi.fn().mockResolvedValue(ticket) } };
    const result = await new TicketGateService(prisma as unknown as PrismaService).inspect({ token, eventId: 'event' });
    expect(result).toMatchObject({ result: 'ALREADY_CHECKED_IN', checkedInAt: checkedInAt.toISOString(), checkedInBy: { id: 'operator-1', displayName: 'Gate Operator' } });
  });

  it('does not expose check-in metadata publicly', async () => {
    const prisma = { ticket: { findUnique: vi.fn().mockResolvedValue(ticket) } };
    expect(await new TicketGateService(prisma as unknown as PrismaService).verify({ token, eventId: 'event' })).toEqual({ result: 'ALREADY_CHECKED_IN' });
  });
});