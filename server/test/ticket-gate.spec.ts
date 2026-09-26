import { PaymentStatus, TeamMemberRole, TicketStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { GateController, TicketGateService } from '../src/ticket-gate';
import { ROLES_KEY } from '../src/auth';
import { PrismaService } from '../src/prisma.service';

const token = 'A'.repeat(43);
const checkedInAt = new Date('2026-09-23T10:00:00.000Z');
const attendedAt = new Date('2026-09-23T10:01:00.000Z');
const kitAt = new Date('2026-09-23T10:02:00.000Z');
const memberId = '4432cd30-c51d-46c5-9cab-bd786b5abbaa';
const ticket = {
  id: 'ticket', status: TicketStatus.CHECKED_IN, checkedInAt, checkedInById: 'operator-1',
  checkedInBy: { displayName: 'Gate Operator' }, kitHandedOverAt: null, kitHandedOverById: null,
  kitHandedOverBy: null,
  registration: {
    id: 'registration', registrationNumber: 'JRC-1', teamName: 'Team', institution: 'PENS',
    competition: { name: 'Sumo', eventId: 'event', eventName: 'JRC' },
    invoice: { paymentStatus: PaymentStatus.PAID },
    members: [{ id: memberId, name: 'Ari', studentId: '1', role: TeamMemberRole.LEADER,
      attendedAt, attendedById: 'operator-1', attendedBy: { displayName: 'Gate Operator' } }],
  },
};

describe('GateController authorization', () => {
  it('allows gate staff and super admins to operate the scanner', () => {
    expect(Reflect.getMetadata(ROLES_KEY, GateController)).toEqual([
      'GATE_STAFF',
      'SUPER_ADMIN',
    ]);
  });
});

describe('TicketGateService attendance and kit handover', () => {
  it('records selected member attendance and checks in an active ticket', async () => {
    const activeTicket = { ...ticket, status: TicketStatus.ACTIVE, checkedInAt: null,
      checkedInById: null, checkedInBy: null,
      registration: { ...ticket.registration, members: ticket.registration.members.map((member) =>
        ({ ...member, attendedAt: null, attendedById: null, attendedBy: null })) } };
    const transaction = {
      ticket: { findUnique: vi.fn().mockResolvedValueOnce(activeTicket).mockResolvedValueOnce(ticket),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      teamMember: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((fn: (tx: typeof transaction) => Promise<unknown>) => fn(transaction)) };

    const result = await new TicketGateService(prisma as unknown as PrismaService).redeem(
      'operator-1', { token, eventId: 'event', memberIds: [memberId] },
      { requestId: 'request', ipAddress: null },
    );

    expect(result).toMatchObject({ result: 'CHECKED_IN', members: [{ id: memberId,
      attendedAt: attendedAt.toISOString(), attendedBy: { id: 'operator-1' } }] });
    expect(transaction.teamMember.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: memberId, registrationId: 'registration', attendedAt: null },
    }));
    expect(transaction.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'MEMBER_ATTENDANCE_RECORDED' }) }));
  });

  it('adds attendance to an already checked-in ticket without replacing original check-in metadata', async () => {
    const pending = { ...ticket, registration: { ...ticket.registration,
      members: ticket.registration.members.map((member) => ({ ...member, attendedAt: null, attendedById: null, attendedBy: null })) } };
    const transaction = {
      ticket: { findUnique: vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(ticket), updateMany: vi.fn() },
      teamMember: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((fn: (tx: typeof transaction) => Promise<unknown>) => fn(transaction)) };
    const result = await new TicketGateService(prisma as unknown as PrismaService).redeem(
      'operator-2', { token, eventId: 'event', memberIds: [memberId] }, { requestId: 'request', ipAddress: null });
    expect(result).toMatchObject({ result: 'CHECKED_IN', checkedInAt: checkedInAt.toISOString(), checkedInBy: { id: 'operator-1' } });
    expect(transaction.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('audits only members won by conditional attendance updates', async () => {
    const secondMemberId = '42f41e21-3f73-445b-8f64-d301a15607e8';
    const pending = {
      ...ticket,
      registration: {
        ...ticket.registration,
        members: [
          { ...ticket.registration.members[0], attendedAt: null, attendedById: null, attendedBy: null },
          { ...ticket.registration.members[0], id: secondMemberId, name: 'Bima', attendedAt: null, attendedById: null, attendedBy: null },
        ],
      },
    };
    const current = {
      ...ticket,
      registration: {
        ...ticket.registration,
        members: [
          ticket.registration.members[0],
          { ...ticket.registration.members[0], id: secondMemberId, name: 'Bima', attendedAt, attendedById: 'operator-3' },
        ],
      },
    };
    const transaction = {
      ticket: { findUnique: vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(current), updateMany: vi.fn() },
      teamMember: { updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((fn: (tx: typeof transaction) => Promise<unknown>) => fn(transaction)) };

    await new TicketGateService(prisma as unknown as PrismaService).redeem(
      'operator-2',
      { token, eventId: 'event', memberIds: [memberId, secondMemberId] },
      { requestId: 'request', ipAddress: null },
    );

    expect(transaction.teamMember.updateMany).toHaveBeenCalledTimes(2);
    expect(transaction.auditLog.create).toHaveBeenCalledTimes(1);
    expect(transaction.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'MEMBER_ATTENDANCE_RECORDED',
        after: { members: [expect.objectContaining({ id: memberId })] },
      }),
    }));
  });

  it('rejects a member outside the ticket registration', async () => {
    const transaction = { ticket: { findUnique: vi.fn().mockResolvedValue(ticket) } };
    const prisma = { $transaction: vi.fn((fn: (tx: typeof transaction) => Promise<unknown>) => fn(transaction)) };
    await expect(new TicketGateService(prisma as unknown as PrismaService).redeem(
      'operator-1', { token, eventId: 'event', memberIds: ['693bc9a7-f93f-4811-ae75-15f274a489af'] },
      { requestId: 'request', ipAddress: null })).rejects.toThrow('Selected members do not belong');
  });

  it('hands over the kit exactly once and returns the original handover on repeat', async () => {
    const handedOver = { ...ticket, kitHandedOverAt: kitAt, kitHandedOverById: 'operator-1',
      kitHandedOverBy: { displayName: 'Gate Operator' } };
    const transaction = {
      ticket: { findUnique: vi.fn().mockResolvedValueOnce(ticket).mockResolvedValueOnce(handedOver),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn((fn: (tx: typeof transaction) => Promise<unknown>) => fn(transaction)) };
    const service = new TicketGateService(prisma as unknown as PrismaService);
    expect(await service.handoverKit('operator-1', { token, eventId: 'event' }, { requestId: 'request', ipAddress: null }))
      .toMatchObject({ kitHandedOverAt: kitAt.toISOString(), kitHandedOverBy: { id: 'operator-1' } });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'JRC_KIT_HANDED_OVER' }) }));
  });

  it('does not audit a kit handover lost to a concurrent request', async () => {
    const handedOver = { ...ticket, kitHandedOverAt: kitAt, kitHandedOverById: 'operator-1',
      kitHandedOverBy: { displayName: 'Gate Operator' } };
    const transaction = {
      ticket: { findUnique: vi.fn().mockResolvedValueOnce(ticket).mockResolvedValueOnce(handedOver),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((fn: (tx: typeof transaction) => Promise<unknown>) => fn(transaction)) };

    const result = await new TicketGateService(prisma as unknown as PrismaService).handoverKit(
      'operator-2', { token, eventId: 'event' }, { requestId: 'request', ipAddress: null },
    );

    expect(result).toMatchObject({ kitHandedOverAt: kitAt.toISOString(), kitHandedOverBy: { id: 'operator-1' } });
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('returns attendance and kit state during gate inspection without exposing it publicly', async () => {
    const handedOver = { ...ticket, kitHandedOverAt: kitAt, kitHandedOverById: 'operator-1', kitHandedOverBy: { displayName: 'Gate Operator' } };
    const prisma = { ticket: { findUnique: vi.fn().mockResolvedValue(handedOver) } };
    const service = new TicketGateService(prisma as unknown as PrismaService);
    expect(await service.inspect({ token, eventId: 'event' })).toMatchObject({ result: 'ALREADY_CHECKED_IN',
      members: [{ id: memberId, attendedAt: attendedAt.toISOString() }], kitHandedOverAt: kitAt.toISOString() });
    expect(await service.verify({ token, eventId: 'event' })).toEqual({ result: 'ALREADY_CHECKED_IN' });
  });
});
