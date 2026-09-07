import {
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
import { IsString, MaxLength } from 'class-validator';
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

const ticketSelect = {
  id: true,
  status: true,
  registration: {
    select: {
      registrationNumber: true,
      teamName: true,
      institution: true,
      competition: {
        select: {
          name: true,
          eventId: true,
          eventName: true,
        },
      },
      invoice: {
        select: {
          paymentStatus: true,
        },
      },
      members: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: {
          name: true,
          studentId: true,
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

type InspectionResult = Exclude<TicketResult, 'CHECKED_IN'>;
type ResultOnly = { result: Exclude<InspectionResult, 'VALID'> };

type PublicTicketIdentity = {
  result: 'VALID';
  teamName: string;
  institution: string;
  competitionName: string;
  registrationNumber: string;
  eventId: string;
  eventName: string;
};

type GateTicketIdentity = {
  result: 'VALID' | 'CHECKED_IN' | 'ALREADY_CHECKED_IN';
  teamName: string;
  institution: string;
  competitionName: string;
  registrationNumber: string;
  eventId: string;
  eventName: string;
  members: Array<{ name: string; studentId: string | null }>;
};

export type PublicTicketVerification = PublicTicketIdentity | ResultOnly;
export type GateTicketVerification = GateTicketIdentity | ResultOnly;

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

function publicIdentity(ticket: TicketRecord): Omit<PublicTicketIdentity, 'result'> {
  return {
    teamName: ticket.registration.teamName,
    institution: ticket.registration.institution,
    competitionName: ticket.registration.competition.name,
    registrationNumber: ticket.registration.registrationNumber,
    eventId: ticket.registration.competition.eventId,
    eventName: ticket.registration.competition.eventName,
  };
}

function gateIdentity(ticket: TicketRecord): Omit<GateTicketIdentity, 'result'> {
  return {
    ...publicIdentity(ticket),
    members: ticket.registration.members.map((member) => ({
      name: member.name,
      studentId: member.studentId,
    })),
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
      if (result !== 'VALID') {
        return result === 'ALREADY_CHECKED_IN'
          ? { result, ...gateIdentity(ticket) }
          : { result };
      }

      const checkedInAt = new Date();
      const updated = await transaction.ticket.updateMany({
        where: {
          id: ticket.id,
          status: TicketStatus.ACTIVE,
        },
        data: {
          status: TicketStatus.CHECKED_IN,
          checkedInAt,
          checkedInById: operatorId,
        },
      });
      if (updated.count !== 1) {
        return { result: 'ALREADY_CHECKED_IN', ...gateIdentity(ticket) };
      }

      await transaction.auditLog.create({
        data: {
          actorId: operatorId,
          action: 'TICKET_CHECKED_IN',
          entityType: 'Ticket',
          entityId: ticket.id,
          before: { status: TicketStatus.ACTIVE },
          after: {
            status: TicketStatus.CHECKED_IN,
            checkedInAt: checkedInAt.toISOString(),
            checkedInById: operatorId,
          },
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
      });

      return { result: 'CHECKED_IN', ...gateIdentity(ticket) };
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

@Roles(Role.GATE_STAFF)
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
    @Body() dto: TicketGateDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GateTicketVerification> {
    return this.tickets.redeem(operator.id, dto, {
      requestId: request.requestId ?? randomUUID(),
      ipAddress: request.ip || request.socket.remoteAddress || null,
    });
  }
}
