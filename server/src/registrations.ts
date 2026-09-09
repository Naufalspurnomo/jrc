import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  Prisma,
  RegistrationStatus,
  Role,
  TeamMemberRole,
} from '@prisma/client';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  AuthPrincipal,
  AuthenticatedRequest,
  CurrentUser,
  Roles,
} from './auth';
import {
  assertRegistrationTransition,
  canEditRegistration,
} from './domain/registration-state';
import { PrismaService } from './prisma.service';

const MAX_TEAM_MEMBERS = 10;
const REGISTRATION_NUMBER_ATTEMPTS = 5;
const EDITABLE_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.DRAFT,
  RegistrationStatus.REVISION_REQUESTED,
];

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRegistrationDto {
  @IsUUID()
  competitionId!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  teamName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  institution!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(32)
  phone?: string | null;
}

export class UpdateRegistrationDto {
  @IsOptional()
  @IsUUID()
  competitionId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  teamName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  institution?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(32)
  phone?: string | null;
}

export class AddTeamMemberDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  studentId?: string | null;

  @IsOptional()
  @IsEnum(TeamMemberRole)
  role?: TeamMemberRole;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  @Matches(/^\+?[0-9][0-9 ()-]*[0-9]$/)
  phone?: string | null;
}

export class UpdateTeamMemberDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  studentId?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  @Matches(/^\+?[0-9][0-9 ()-]*[0-9]$/)
  phone?: string | null;
}

const registrationSelect = {
  id: true,
  registrationNumber: true,
  competitionId: true,
  teamName: true,
  institution: true,
  phone: true,
  status: true,
  reviewReason: true,
  submittedAt: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  competition: {
    select: {
      id: true,
      slug: true,
      name: true,
      level: true,
      discipline: true,
      description: true,
      eventId: true,
      eventName: true,
      fee: true,
      currency: true,
      registrationDeadline: true,
    },
  },
  members: {
    orderBy: [
      { createdAt: 'asc' as const },
      { id: 'asc' as const },
    ],
    select: {
      id: true,
      name: true,
      studentId: true,
      role: true,
      email: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  documents: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      category: true,
      originalName: true,
      mimeType: true,
      size: true,
      createdAt: true,
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      currency: true,
      provider: true,
      paymentStatus: true,
      deadline: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  ticket: {
    select: {
      id: true,
      status: true,
      issuedAt: true,
    },
  },
} satisfies Prisma.RegistrationSelect;

type RegistrationRecord = Prisma.RegistrationGetPayload<{
  select: typeof registrationSelect;
}>;

type MemberRecord = {
  id: string;
  name: string;
  studentId: string | null;
  role: TeamMemberRole;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeMember(member: MemberRecord) {
  return {
    id: member.id,
    name: member.name,
    studentId: member.studentId,
    role: member.role,
    email: member.email,
    phone: member.phone,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

function serializeRegistration(registration: RegistrationRecord) {
  return {
    id: registration.id,
    registrationNumber: registration.registrationNumber,
    competitionId: registration.competitionId,
    teamName: registration.teamName,
    institution: registration.institution,
    phone: registration.phone,
    status: registration.status,
    reviewReason: registration.reviewReason,
    submittedAt: registration.submittedAt?.toISOString() ?? null,
    reviewedAt: registration.reviewedAt?.toISOString() ?? null,
    createdAt: registration.createdAt.toISOString(),
    updatedAt: registration.updatedAt.toISOString(),
    competition: {
      id: registration.competition.id,
      slug: registration.competition.slug,
      name: registration.competition.name,
      level: registration.competition.level,
      discipline: registration.competition.discipline,
      description: registration.competition.description,
      eventId: registration.competition.eventId,
      eventName: registration.competition.eventName,
      fee: registration.competition.fee,
      currency: registration.competition.currency,
      registrationDeadline:
        registration.competition.registrationDeadline.toISOString(),
    },
    members: registration.members.map(serializeMember),
    documents: registration.documents.map((document) => ({
      id: document.id,
      category: document.category,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      createdAt: document.createdAt.toISOString(),
      downloadUrl: `/api/registrations/${encodeURIComponent(registration.id)}/documents/${encodeURIComponent(document.id)}`,
    })),
    invoice: registration.invoice
      ? {
          id: registration.invoice.id,
          invoiceNumber: registration.invoice.invoiceNumber,
          amount: registration.invoice.amount,
          currency: registration.invoice.currency,
          provider: registration.invoice.provider,
          paymentStatus: registration.invoice.paymentStatus,
          deadline: registration.invoice.deadline.toISOString(),
          createdAt: registration.invoice.createdAt.toISOString(),
          updatedAt: registration.invoice.updatedAt.toISOString(),
        }
      : null,
    ticket: registration.ticket
      ? {
          id: registration.ticket.id,
          status: registration.ticket.status,
          issuedAt: registration.ticket.issuedAt.toISOString(),
        }
      : null,
  };
}

export type SerializedRegistration = ReturnType<typeof serializeRegistration>;
export type SerializedTeamMember = ReturnType<typeof serializeMember>;

interface AuditContext {
  requestId: string;
  ipAddress: string | null;
}

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string): Promise<SerializedRegistration[]> {
    const registrations = await this.prisma.registration.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      select: registrationSelect,
    });
    return registrations.map(serializeRegistration);
  }

  async create(
    ownerId: string,
    dto: CreateRegistrationDto,
  ): Promise<SerializedRegistration> {
    await this.requireOpenCompetition(dto.competitionId);

    for (let attempt = 0; attempt < REGISTRATION_NUMBER_ATTEMPTS; attempt += 1) {
      try {
        const registration = await this.prisma.registration.create({
          data: {
            registrationNumber: this.newRegistrationNumber(),
            ownerId,
            competitionId: dto.competitionId,
            teamName: dto.teamName.trim(),
            institution: dto.institution.trim(),
            phone: dto.phone?.trim() || null,
          },
          select: registrationSelect,
        });
        return serializeRegistration(registration);
      } catch (error: unknown) {
        if (this.isUniqueConstraintError(error)) continue;
        throw error;
      }
    }

    throw new BadRequestException('Could not allocate a registration number');
  }

  async get(ownerId: string, id: string): Promise<SerializedRegistration> {
    const registration = await this.prisma.registration.findFirst({
      where: { id, ownerId },
      select: registrationSelect,
    });
    if (!registration) throw new NotFoundException('Registration not found');
    return serializeRegistration(registration);
  }

  async update(
    ownerId: string,
    id: string,
    dto: UpdateRegistrationDto,
  ): Promise<SerializedRegistration> {
    const current = await this.prisma.registration.findFirst({
      where: { id, ownerId },
      select: { status: true },
    });
    if (!current) throw new NotFoundException('Registration not found');
    this.assertEditable(current.status);

    if (dto.competitionId !== undefined) {
      await this.requireOpenCompetition(dto.competitionId);
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.registration.updateMany({
        where: { id, ownerId, status: { in: EDITABLE_STATUSES } },
        data: {
          ...(dto.competitionId === undefined
            ? {}
            : { competitionId: dto.competitionId }),
          ...(dto.teamName === undefined
            ? {}
            : { teamName: dto.teamName.trim() }),
          ...(dto.institution === undefined
            ? {}
            : { institution: dto.institution.trim() }),
          ...(dto.phone === undefined
            ? {}
            : { phone: dto.phone?.trim() || null }),
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'Registration is not editable in its current status',
        );
      }

      const registration = await transaction.registration.findUnique({
        where: { id },
        select: registrationSelect,
      });
      if (!registration) throw new NotFoundException('Registration not found');
      return serializeRegistration(registration);
    });
  }

  async addMember(
    ownerId: string,
    registrationId: string,
    dto: AddTeamMemberDto,
  ): Promise<SerializedTeamMember> {
    try {
      return await this.withSerializableRetry(async (transaction) => {
        const registration = await transaction.registration.findFirst({
          where: { id: registrationId, ownerId },
          select: { status: true },
        });
        if (!registration) {
          throw new NotFoundException('Registration not found');
        }
        this.assertEditable(registration.status);

        const memberCount = await transaction.teamMember.count({
          where: { registrationId },
        });
        if (memberCount >= MAX_TEAM_MEMBERS) {
          throw new BadRequestException(
            `A registration may have at most ${MAX_TEAM_MEMBERS} members`,
          );
        }

        const leaderCount = await transaction.teamMember.count({
          where: { registrationId, role: TeamMemberRole.LEADER },
        });
        if (dto.role === TeamMemberRole.LEADER && leaderCount > 0) {
          throw new BadRequestException(
            'A registration may have only one team leader',
          );
        }

        const role =
          dto.role ??
          (memberCount === 0 ? TeamMemberRole.LEADER : TeamMemberRole.MEMBER);
        const member = await transaction.teamMember.create({
          data: {
            registrationId,
            name: dto.name.trim(),
            studentId: dto.studentId?.trim() || null,
            role,
            email: dto.email?.trim() || null,
            phone: dto.phone?.trim() || null,
          },
          select: {
            id: true,
            name: true,
            studentId: true,
            role: true,
            email: true,
            phone: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return serializeMember(member);
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new BadRequestException(
          'A registration may have only one team leader',
        );
      }
      throw error;
    }
  }

  async updateMember(
    ownerId: string,
    registrationId: string,
    memberId: string,
    dto: UpdateTeamMemberDto,
  ): Promise<SerializedTeamMember> {
    return this.prisma.$transaction(async (transaction) => {
      const registration = await transaction.registration.findFirst({
        where: { id: registrationId, ownerId },
        select: { status: true },
      });
      if (!registration) throw new NotFoundException('Registration not found');
      this.assertEditable(registration.status);

      const updated = await transaction.teamMember.updateMany({
        where: { id: memberId, registrationId },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.studentId === undefined
            ? {}
            : { studentId: dto.studentId?.trim() || null }),
          ...(dto.email === undefined
            ? {}
            : { email: dto.email?.trim() || null }),
          ...(dto.phone === undefined
            ? {}
            : { phone: dto.phone?.trim() || null }),
        },
      });
      if (updated.count !== 1) throw new NotFoundException('Member not found');

      const member = await transaction.teamMember.findFirst({
        where: { id: memberId, registrationId },
        select: {
          id: true,
          name: true,
          studentId: true,
          role: true,
          email: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!member) throw new NotFoundException('Member not found');
      return serializeMember(member);
    });
  }

  async removeMember(
    ownerId: string,
    registrationId: string,
    memberId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const registration = await transaction.registration.findFirst({
        where: { id: registrationId, ownerId },
        select: { status: true },
      });
      if (!registration) throw new NotFoundException('Registration not found');
      this.assertEditable(registration.status);

      const member = await transaction.teamMember.findFirst({
        where: { id: memberId, registrationId },
        select: { role: true },
      });
      if (!member) throw new NotFoundException('Member not found');
      if (member.role === TeamMemberRole.LEADER) {
        throw new BadRequestException('The team leader cannot be removed');
      }

      const deleted = await transaction.teamMember.deleteMany({
        where: { id: memberId, registrationId },
      });
      if (deleted.count !== 1) throw new NotFoundException('Member not found');
    });
  }

  async submit(
    ownerId: string,
    id: string,
    audit: AuditContext,
  ): Promise<SerializedRegistration> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.registration.findFirst({
        where: { id, ownerId },
        select: {
          status: true,
          teamName: true,
          institution: true,
          competitionId: true,
          submittedAt: true,
          reviewReason: true,
          competition: { select: { id: true } },
          _count: { select: { members: true, documents: true } },
        },
      });
      if (!current) throw new NotFoundException('Registration not found');

      const owner = await transaction.user.findUnique({
        where: { id: ownerId },
        select: { emailVerifiedAt: true },
      });
      if (!owner?.emailVerifiedAt) {
        throw new ForbiddenException(
          'Verify your email address before submitting a registration',
        );
      }

      if (
        !current.teamName.trim() ||
        !current.institution.trim() ||
        !current.competitionId.trim() ||
        !current.competition
      ) {
        throw new BadRequestException(
          'Team, institution, and competition are required',
        );
      }
      if (current._count.members < 1) {
        throw new BadRequestException(
          'At least one team member is required before submission',
        );
      }
      if (current._count.documents < 1) {
        throw new BadRequestException(
          'At least one document is required before submission',
        );
      }

      const leaderCount = await transaction.teamMember.count({
        where: { registrationId: id, role: TeamMemberRole.LEADER },
      });
      if (leaderCount !== 1) {
        throw new BadRequestException(
          'Exactly one team leader is required before submission',
        );
      }

      assertRegistrationTransition(current.status, RegistrationStatus.SUBMITTED);
      const submittedAt = new Date();
      const updated = await transaction.registration.updateMany({
        where: { id, ownerId, status: current.status },
        data: {
          status: RegistrationStatus.SUBMITTED,
          submittedAt,
          reviewReason: null,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'Registration status changed before submission',
        );
      }

      await transaction.auditLog.create({
        data: {
          actorId: ownerId,
          action: 'REGISTRATION_SUBMITTED',
          entityType: 'Registration',
          entityId: id,
          before: {
            status: current.status,
            submittedAt: current.submittedAt?.toISOString() ?? null,
            reviewReason: current.reviewReason,
          },
          after: {
            status: RegistrationStatus.SUBMITTED,
            submittedAt: submittedAt.toISOString(),
            reviewReason: null,
          },
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
      });

      const registration = await transaction.registration.findUnique({
        where: { id },
        select: registrationSelect,
      });
      if (!registration) throw new NotFoundException('Registration not found');
      return serializeRegistration(registration);
    });
  }

  private async requireOpenCompetition(competitionId: string): Promise<void> {
    const competition = await this.prisma.competition.findFirst({
      where: {
        id: competitionId,
        active: true,
        registrationDeadline: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!competition) {
      throw new BadRequestException(
        'Competition is inactive or its registration deadline has passed',
      );
    }
  }

  private assertEditable(status: RegistrationStatus): void {
    if (!canEditRegistration(status)) {
      throw new BadRequestException(
        'Registration is not editable in its current status',
      );
    }
  }

  private newRegistrationNumber(): string {
    const year = new Date().getUTCFullYear();
    const suffix = randomBytes(5).toString('hex').toUpperCase();
    return `JRC14-${year}-${suffix}`;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private async withSerializableRetry<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (!retryable || attempt === 2) throw error;
      }
    }
    throw new BadRequestException('Could not add member');
  }
}

@Roles(Role.PARTICIPANT)
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthPrincipal,
  ): Promise<SerializedRegistration[]> {
    return this.registrations.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: CreateRegistrationDto,
  ): Promise<SerializedRegistration> {
    return this.registrations.create(user.id, dto);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SerializedRegistration> {
    return this.registrations.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRegistrationDto,
  ): Promise<SerializedRegistration> {
    return this.registrations.update(user.id, id, dto);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddTeamMemberDto,
  ): Promise<SerializedTeamMember> {
    return this.registrations.addMember(user.id, id, dto);
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() dto: UpdateTeamMemberDto,
  ): Promise<SerializedTeamMember> {
    return this.registrations.updateMember(user.id, id, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.OK)
  async removeMember(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ): Promise<{ success: true }> {
    await this.registrations.removeMember(user.id, id, memberId);
    return { success: true };
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<SerializedRegistration> {
    return this.registrations.submit(user.id, id, {
      requestId: request.requestId ?? randomUUID(),
      ipAddress: request.ip || request.socket.remoteAddress || null,
    });
  }
}
