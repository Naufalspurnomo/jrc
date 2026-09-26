import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Injectable,
  Post,
  Req,
} from '@nestjs/common';
import { PaymentStatus, Prisma, Role, TicketStatus } from '@prisma/client';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { randomUUID } from 'node:crypto';
import {
  AuthPrincipal,
  AuthenticatedRequest,
  CurrentUser,
  Public,
  Roles,
} from './auth';
import { hashTicketToken } from './common/ticket-token';
import { PrismaService } from './prisma.service';

const TICKET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class TicketGateDto {
  @Transform(trim)
  @IsString()
  @MaxLength(512)
  token!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(200)
  eventId!: string;
}

export class TicketRedeemDto extends TicketGateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsUUID('4', { each: true })
  memberIds!: string[];
}

const ticketSelect = {
  id: true,
  status: true,
  checkedInAt: true,
  checkedInById: true,
  checkedInBy: { select: { displayName: true } },
  kitHandedOverAt: true,
  kitHandedOverById: true,
  kitHandedOverBy: { select: { displayName: true } },
  registration: {
    select: {
      id: true,
      registrationNumber: true,
      teamName: true,
      institution: true,
      competition: {
        select: { name: true, eventId: true, eventName: true },
      },
      invoice: { select: { paymentStatus: true } },
      members: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: {
          id: true,
          name: true,
          studentId: true,
          role: true,
          attendedAt: true,
          attendedById: true,
          attendedBy: { select: { displayName: true } },
        },
      },
    },
  },
} satisfies Prisma.TicketSelect;

type TicketRecord = Prisma.TicketGetPayload<{ select: typeof ticketSelect }>;
type TicketResult =
  | 'VALID'
  | 'CHECKED_IN'
  | 'ALREADY_CHECKED_IN'
  | 'REVOKED'
  | 'UNKNOWN'
  | 'NOT_PAID'
  | 'WRONG_EVENT';
type PublicResultOnly = {
  result: Exclude<TicketResult, 'VALID' | 'CHECKED_IN'>;
};
type GateResultOnly = {
  result: Exclude<TicketResult, 'VALID' | 'CHECKED_IN' | 'ALREADY_CHECKED_IN'>;
};
type OperatorIdentity = { id: string; displayName: string };
type PublicIdentity = {
  result: 'VALID';
  teamName: string;
  institution: string;
  competitionName: string;
  registrationNumber: string;
  eventId: string;
  eventName: string;
};
type GateIdentity = Omit<PublicIdentity, 'result'> & {
  result: 'VALID' | 'CHECKED_IN' | 'ALREADY_CHECKED_IN';
  members: Array<{
    id: string;
    name: string;
    studentId: string | null;
    role: string;
    attendedAt: string | null;
    attendedBy: OperatorIdentity | null;
  }>;
  checkedInAt: string | null;
  checkedInBy: OperatorIdentity | null;
  kitHandedOverAt: string | null;
  kitHandedOverBy: OperatorIdentity | null;
};

export type PublicTicketVerification = PublicIdentity | PublicResultOnly;
export type GateTicketVerification = GateIdentity | GateResultOnly;

interface AuditContext {
  requestId: string;
  ipAddress: string | null;
}

function classifyTicket(
  ticket: TicketRecord,
  eventId: string,
): Exclude<TicketResult, 'CHECKED_IN'> {
  if (ticket.registration.competition.eventId !== eventId) return 'WRONG_EVENT';
  if (ticket.status === TicketStatus.REVOKED) return 'REVOKED';
  if (
    ticket.status === TicketStatus.INACTIVE ||
    ticket.registration.invoice?.paymentStatus !== PaymentStatus.PAID
  ) {
    return 'NOT_PAID';
  }
  if (ticket.status === TicketStatus.CHECKED_IN) return 'ALREADY_CHECKED_IN';
  return ticket.status === TicketStatus.ACTIVE ? 'VALID' : 'UNKNOWN';
}

function publicIdentity(ticket: TicketRecord): Omit<PublicIdentity, 'result'> {
  return {
    teamName: ticket.registration.teamName,
    institution: ticket.registration.institution,
    competitionName: ticket.registration.competition.name,
    registrationNumber: ticket.registration.registrationNumber,
    eventId: ticket.registration.competition.eventId,
    eventName: ticket.registration.competition.eventName,
  };
}

function operatorIdentity(
  id: string | null,
  operator: { displayName: string } | null,
): OperatorIdentity | null {
  return id
    ? { id, displayName: operator?.displayName ?? 'Unknown operator' }
    : null;
}

function gateIdentity(ticket: TicketRecord): Omit<GateIdentity, 'result'> {
  return {
    ...publicIdentity(ticket),
    members: ticket.registration.members.map((member) => ({
      id: member.id,
      name: member.name,
      studentId: member.studentId,
      role: member.role,
      attendedAt: member.attendedAt?.toISOString() ?? null,
      attendedBy: operatorIdentity(member.attendedById, member.attendedBy),
    })),
    checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
    checkedInBy: operatorIdentity(ticket.checkedInById, ticket.checkedInBy),
    kitHandedOverAt: ticket.kitHandedOverAt?.toISOString() ?? null,
    kitHandedOverBy: operatorIdentity(
      ticket.kitHandedOverById,
      ticket.kitHandedOverBy,
    ),
  };
}

@Injectable()
export class TicketGateService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(dto: TicketGateDto): Promise<PublicTicketVerification> {
    const ticket = await this.findTicket(dto.token);
    if (!ticket) return { result: 'UNKNOWN' };

    const result = classifyTicket(ticket, dto.eventId);
    return result === 'VALID'
      ? { result, ...publicIdentity(ticket) }
      : { result };
  }

  async inspect(dto: TicketGateDto): Promise<GateTicketVerification> {
    const ticket = await this.findTicket(dto.token);
    if (!ticket) return { result: 'UNKNOWN' };

    const result = classifyTicket(ticket, dto.eventId);
    return result === 'VALID' || result === 'ALREADY_CHECKED_IN'
      ? { result, ...gateIdentity(ticket) }
      : { result };
  }

  async redeem(
    operatorId: string,
    dto: TicketRedeemDto,
    audit: AuditContext,
  ): Promise<GateTicketVerification> {
    if (!TICKET_TOKEN_PATTERN.test(dto.token)) return { result: 'UNKNOWN' };

    return this.prisma.$transaction(async (transaction) => {
      const ticket = await transaction.ticket.findUnique({
        where: { tokenHash: hashTicketToken(dto.token) },
        select: ticketSelect,
      });
      if (!ticket) return { result: 'UNKNOWN' };

      const result = classifyTicket(ticket, dto.eventId);
      if (result !== 'VALID' && result !== 'ALREADY_CHECKED_IN') {
        return { result };
      }

      const memberIds = [...new Set(dto.memberIds)];
      const registrationMemberIds = new Set(
        ticket.registration.members.map((member) => member.id),
      );
      if (memberIds.some((memberId) => !registrationMemberIds.has(memberId))) {
        throw new BadRequestException(
          'Selected members do not belong to this ticket registration',
        );
      }

      const recordedAt = new Date();
      const transitionedMemberIds: string[] = [];
      for (const memberId of memberIds) {
        const updated = await transaction.teamMember.updateMany({
          where: {
            id: memberId,
            registrationId: ticket.registration.id,
            attendedAt: null,
          },
          data: { attendedAt: recordedAt, attendedById: operatorId },
        });
        if (updated.count === 1) transitionedMemberIds.push(memberId);
      }

      if (transitionedMemberIds.length > 0) {
        await transaction.auditLog.create({
          data: {
            actorId: operatorId,
            action: 'MEMBER_ATTENDANCE_RECORDED',
            entityType: 'Registration',
            entityId: ticket.registration.id,
            before: {
              members: transitionedMemberIds.map((id) => ({
                id,
                attendedAt: null,
                attendedById: null,
              })),
            },
            after: {
              members: transitionedMemberIds.map((id) => ({
                id,
                attendedAt: recordedAt.toISOString(),
                attendedById: operatorId,
              })),
            },
            requestId: audit.requestId,
            ipAddress: audit.ipAddress,
          },
        });
      }

      if (result === 'VALID') {
        const updated = await transaction.ticket.updateMany({
          where: { id: ticket.id, status: TicketStatus.ACTIVE },
          data: {
            status: TicketStatus.CHECKED_IN,
            checkedInAt: recordedAt,
            checkedInById: operatorId,
          },
        });
        if (updated.count === 1) {
          await transaction.auditLog.create({
            data: {
              actorId: operatorId,
              action: 'TICKET_CHECKED_IN',
              entityType: 'Ticket',
              entityId: ticket.id,
              before: { status: TicketStatus.ACTIVE },
              after: {
                status: TicketStatus.CHECKED_IN,
                checkedInAt: recordedAt.toISOString(),
                checkedInById: operatorId,
              },
              requestId: audit.requestId,
              ipAddress: audit.ipAddress,
            },
          });
        }
      }

      const current = await transaction.ticket.findUnique({
        where: { id: ticket.id },
        select: ticketSelect,
      });
      return current
        ? { result: 'CHECKED_IN', ...gateIdentity(current) }
        : { result: 'UNKNOWN' };
    });
  }

  async handoverKit(
    operatorId: string,
    dto: TicketGateDto,
    audit: AuditContext,
  ): Promise<GateTicketVerification> {
    if (!TICKET_TOKEN_PATTERN.test(dto.token)) return { result: 'UNKNOWN' };

    return this.prisma.$transaction(async (transaction) => {
      const ticket = await transaction.ticket.findUnique({
        where: { tokenHash: hashTicketToken(dto.token) },
        select: ticketSelect,
      });
      if (!ticket) return { result: 'UNKNOWN' };

      const result = classifyTicket(ticket, dto.eventId);
      if (result === 'VALID') return { result, ...gateIdentity(ticket) };
      if (result !== 'ALREADY_CHECKED_IN') return { result };

      if (!ticket.kitHandedOverAt) {
        const handedOverAt = new Date();
        const updated = await transaction.ticket.updateMany({
          where: {
            id: ticket.id,
            status: TicketStatus.CHECKED_IN,
            kitHandedOverAt: null,
          },
          data: { kitHandedOverAt: handedOverAt, kitHandedOverById: operatorId },
        });
        if (updated.count === 1) {
          await transaction.auditLog.create({
            data: {
              actorId: operatorId,
              action: 'JRC_KIT_HANDED_OVER',
              entityType: 'Ticket',
              entityId: ticket.id,
              before: { kitHandedOverAt: null, kitHandedOverById: null },
              after: {
                kitHandedOverAt: handedOverAt.toISOString(),
                kitHandedOverById: operatorId,
              },
              requestId: audit.requestId,
              ipAddress: audit.ipAddress,
            },
          });
        }
      }

      const current = await transaction.ticket.findUnique({
        where: { id: ticket.id },
        select: ticketSelect,
      });
      return current
        ? { result: 'ALREADY_CHECKED_IN', ...gateIdentity(current) }
        : { result: 'UNKNOWN' };
    });
  }

  private findTicket(token: string): Promise<TicketRecord | null> {
    if (!TICKET_TOKEN_PATTERN.test(token)) return Promise.resolve(null);
    return this.prisma.ticket.findUnique({
      where: { tokenHash: hashTicketToken(token) },
      select: ticketSelect,
    });
  }
}

@Public()
@Controller('tickets')
export class TicketVerificationController {
  constructor(private readonly tickets: TicketGateService) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: TicketGateDto): Promise<PublicTicketVerification> {
    return this.tickets.verify(dto);
  }
}

@Roles(Role.GATE_STAFF, Role.SUPER_ADMIN)
@Controller('gate')
export class GateController {
  constructor(private readonly tickets: TicketGateService) {}

  @Post('inspect')
  inspect(@Body() dto: TicketGateDto): Promise<GateTicketVerification> {
    return this.tickets.inspect(dto);
  }

  @Post('redeem')
  redeem(
    @CurrentUser() operator: AuthPrincipal,
    @Body() dto: TicketRedeemDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GateTicketVerification> {
    return this.tickets.redeem(operator.id, dto, {
      requestId: request.requestId ?? randomUUID(),
      ipAddress: request.ip || request.socket.remoteAddress || null,
    });
  }

  @Post('kit')
  kit(
    @CurrentUser() operator: AuthPrincipal,
    @Body() dto: TicketGateDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GateTicketVerification> {
    return this.tickets.handoverKit(operator.id, dto, {
      requestId: request.requestId ?? randomUUID(),
      ipAddress: request.ip || request.socket.remoteAddress || null,
    });
  }
}
