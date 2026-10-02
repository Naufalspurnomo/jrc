import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import { OutboxStatus, Prisma, Role } from '@prisma/client';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { randomUUID } from 'node:crypto';
import {
  AuthPrincipal,
  AuthenticatedRequest,
  CurrentUser,
  Roles,
} from './auth';
import { PrismaService } from './prisma.service';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AdminParticipantListDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

interface AuditContext {
  requestId: string;
  ipAddress: string | null;
}

const participantSelect = {
  id: true,
  email: true,
  displayName: true,
  active: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  registrations: {
    take: 1,
    select: {
      id: true,
      registrationNumber: true,
      teamName: true,
      status: true,
      updatedAt: true,
      invoice: { select: { paymentStatus: true } },
      ticket: { select: { status: true } },
    },
  },
  _count: { select: { sessions: true } },
} satisfies Prisma.UserSelect;

type ParticipantRecord = Prisma.UserGetPayload<{ select: typeof participantSelect }>;

function serializeParticipant(participant: ParticipantRecord) {
  const registration = participant.registrations[0];
  return {
    id: participant.id,
    email: participant.email,
    displayName: participant.displayName,
    active: participant.active,
    emailVerified: participant.emailVerifiedAt !== null,
    createdAt: participant.createdAt.toISOString(),
    updatedAt: participant.updatedAt.toISOString(),
    sessionCount: participant._count.sessions,
    registration: registration
      ? {
          id: registration.id,
          registrationNumber: registration.registrationNumber,
          teamName: registration.teamName,
          status: registration.status,
          paymentStatus: registration.invoice?.paymentStatus ?? null,
          ticketStatus: registration.ticket?.status ?? null,
          updatedAt: registration.updatedAt.toISOString(),
        }
      : null,
    deletionBlocked: Boolean(registration),
  };
}

export type SerializedAdminParticipant = ReturnType<typeof serializeParticipant>;

@Injectable()
export class AdminParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminParticipantListDto): Promise<SerializedAdminParticipant[]> {
    const search = query.query?.trim();
    const participants = await this.prisma.user.findMany({
      where: {
        role: Role.PARTICIPANT,
        ...(search
          ? {
              OR: [
                {
                  displayName: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  email: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 50),
      take: query.pageSize ?? 50,
      select: participantSelect,
    });
    return participants.map(serializeParticipant);
  }

  async delete(
    actorId: string,
    id: string,
    audit: AuditContext,
  ): Promise<{ deleted: true }> {
    if (actorId === id) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const current = await transaction.user.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            active: true,
            emailVerifiedAt: true,
            createdAt: true,
            registrations: {
              take: 1,
              select: {
                id: true,
                registrationNumber: true,
                invoice: { select: { id: true } },
                ticket: { select: { id: true } },
              },
            },
          },
        });
        if (!current) throw new NotFoundException('Participant account not found');
        if (current.role !== Role.PARTICIPANT) {
          throw new ForbiddenException('Administrative accounts cannot be deleted here');
        }
        if (current.registrations.length > 0) {
          throw new BadRequestException(
            'Participant account has registration, payment, or ticket activity and cannot be deleted',
          );
        }

        await transaction.emailOutbox.deleteMany({
          where: {
            to: current.email,
            subject: {
              in: [
                'Verifikasi email akun JRC XIV',
                'Reset kata sandi akun JRC XIV',
              ],
            },
            status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
          },
        });

        const deleted = await transaction.user.deleteMany({
          where: {
            id,
            role: Role.PARTICIPANT,
            registrations: { none: {} },
          },
        });
        if (deleted.count !== 1) {
          throw new BadRequestException(
            'Participant activity changed before deletion was completed',
          );
        }

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'PARTICIPANT_ACCOUNT_DELETED',
            entityType: 'User',
            entityId: id,
            before: {
              email: current.email,
              displayName: current.displayName,
              active: current.active,
              emailVerified: current.emailVerifiedAt !== null,
              createdAt: current.createdAt.toISOString(),
            },
            reason: 'Super Admin deleted an activity-free participant account',
            requestId: audit.requestId,
            ipAddress: audit.ipAddress,
          },
        });
        return { deleted: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

@Roles(Role.SUPER_ADMIN)
@Controller('admin/participants')
export class AdminParticipantsController {
  constructor(private readonly participants: AdminParticipantsService) {}

  @Get()
  list(@Query() query: AdminParticipantListDto): Promise<SerializedAdminParticipant[]> {
    return this.participants.list(query);
  }

  @Delete(':id')
  deleteParticipant(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ deleted: true }> {
    return this.participants.delete(user.id, id, {
      requestId: request.requestId ?? randomUUID(),
      ipAddress: request.ip || request.socket.remoteAddress || null,
    });
  }
}
