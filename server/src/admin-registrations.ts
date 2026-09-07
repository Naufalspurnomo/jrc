import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Prisma, RegistrationStatus, Role } from '@prisma/client';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import {
  AuthPrincipal,
  AuthenticatedRequest,
  CurrentUser,
  Roles,
} from './auth';
import { csvRow } from './common/csv';
import { assertRegistrationTransition } from './domain/registration-state';
import { ManualPaymentProvider } from './payments/manual-payment.provider';
import { PrismaService } from './prisma.service';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const REVIEW_STATUSES = [
  RegistrationStatus.UNDER_REVIEW,
  RegistrationStatus.APPROVED,
  RegistrationStatus.REVISION_REQUESTED,
  RegistrationStatus.REJECTED,
] as const;

type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export class AdminRegistrationFiltersDto {
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @IsOptional()
  @IsUUID()
  competitionId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  query?: string;
}

export class AdminRegistrationListDto extends AdminRegistrationFiltersDto {
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
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ReviewRegistrationDto {
  @IsIn([...REVIEW_STATUSES])
  status!: ReviewStatus;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  reason?: string;
}

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  amount: true,
  currency: true,
  provider: true,
  instructions: true,
  paymentStatus: true,
  deadline: true,
  proofOriginalName: true,
  proofMimeType: true,
  proofSize: true,
  verificationReason: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InvoiceSelect;

const adminRegistrationSelect = {
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
  owner: {
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  },
  competition: {
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      eventId: true,
      eventName: true,
      fee: true,
      currency: true,
      registrationDeadline: true,
    },
  },
  members: {
    orderBy: { createdAt: 'asc' as const },
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
  invoice: { select: invoiceSelect },
  ticket: { select: { status: true } },
} satisfies Prisma.RegistrationSelect;

type AdminRegistrationRecord = Prisma.RegistrationGetPayload<{
  select: typeof adminRegistrationSelect;
}>;

type InvoiceRecord = Prisma.InvoiceGetPayload<{
  select: typeof invoiceSelect;
}>;

function instructionsObject(
  instructions: Prisma.JsonValue,
): Record<string, unknown> {
  if (
    instructions === null ||
    typeof instructions !== 'object' ||
    Array.isArray(instructions)
  ) {
    return {};
  }
  return { ...instructions };
}

function serializeProof(invoice: InvoiceRecord) {
  if (
    invoice.proofOriginalName === null &&
    invoice.proofMimeType === null &&
    invoice.proofSize === null
  ) {
    return null;
  }
  return {
    originalName: invoice.proofOriginalName,
    mimeType: invoice.proofMimeType,
    size: invoice.proofSize,
  };
}

function serializeInvoice(invoice: InvoiceRecord) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    currency: invoice.currency,
    provider: invoice.provider,
    instructions: instructionsObject(invoice.instructions),
    paymentStatus: invoice.paymentStatus,
    deadline: invoice.deadline.toISOString(),
    proof: serializeProof(invoice),
    verificationReason: invoice.verificationReason,
    verifiedAt: invoice.verifiedAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

function serializeAdminRegistration(registration: AdminRegistrationRecord) {
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
    owner: {
      id: registration.owner.id,
      email: registration.owner.email,
      displayName: registration.owner.displayName,
    },
    competition: {
      id: registration.competition.id,
      slug: registration.competition.slug,
      name: registration.competition.name,
      description: registration.competition.description,
      eventId: registration.competition.eventId,
      eventName: registration.competition.eventName,
      fee: registration.competition.fee,
      currency: registration.competition.currency,
      registrationDeadline:
        registration.competition.registrationDeadline.toISOString(),
    },
    members: registration.members.map((member) => ({
      id: member.id,
      name: member.name,
      studentId: member.studentId,
      role: member.role,
      email: member.email,
      phone: member.phone,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    })),
    documents: registration.documents.map((document) => ({
      id: document.id,
      category: document.category,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      createdAt: document.createdAt.toISOString(),
      downloadUrl: `/api/admin/registrations/${encodeURIComponent(registration.id)}/documents/${encodeURIComponent(document.id)}`,
    })),
    invoice: registration.invoice
      ? serializeInvoice(registration.invoice)
      : null,
    ticketStatus: registration.ticket?.status ?? null,
  };
}

export type SerializedAdminRegistration = ReturnType<
  typeof serializeAdminRegistration
>;
export type SerializedInvoice = ReturnType<typeof serializeInvoice>;

interface AuditContext {
  requestId: string;
  ipAddress: string | null;
}

function registrationWhere(
  filters: AdminRegistrationFiltersDto,
): Prisma.RegistrationWhereInput {
  const query = filters.query?.trim();
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.competitionId
      ? { competitionId: filters.competitionId }
      : {}),
    ...(query
      ? {
          OR: [
            {
              registrationNumber: {
                contains: query,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              teamName: {
                contains: query,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              institution: {
                contains: query,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              owner: {
                is: {
                  displayName: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            },
            {
              owner: {
                is: {
                  email: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
}

function paymentDeadline(now: Date): Date {
  const days = Number(process.env.PAYMENT_DEADLINE_DAYS ?? '3');
  if (!Number.isFinite(days) || days <= 0) {
    throw new BadRequestException('PAYMENT_DEADLINE_DAYS must be positive');
  }
  const deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1_000);
  if (!Number.isFinite(deadline.getTime())) {
    throw new BadRequestException('PAYMENT_DEADLINE_DAYS is too large');
  }
  return deadline;
}

function invoiceNumber(now: Date): string {
  return `JRC-INV-${now.getUTCFullYear()}-${randomUUID().replaceAll('-', '').toUpperCase()}`;
}

const REVIEW_ACTIONS: Record<ReviewStatus, string> = {
  UNDER_REVIEW: 'REGISTRATION_UNDER_REVIEW',
  APPROVED: 'REGISTRATION_APPROVED',
  REVISION_REQUESTED: 'REGISTRATION_REVISION_REQUESTED',
  REJECTED: 'REGISTRATION_REJECTED',
};

@Injectable()
export class AdminRegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manualPayment: ManualPaymentProvider,
  ) {}

  async list(
    query: AdminRegistrationListDto,
  ): Promise<SerializedAdminRegistration[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? query.limit ?? 50;
    const registrations = await this.prisma.registration.findMany({
      where: registrationWhere(query),
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: adminRegistrationSelect,
    });
    return registrations.map(serializeAdminRegistration);
  }

  async get(id: string): Promise<SerializedAdminRegistration> {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      select: adminRegistrationSelect,
    });
    if (!registration) throw new NotFoundException('Registration not found');
    return serializeAdminRegistration(registration);
  }

  async exportCsv(filters: AdminRegistrationFiltersDto): Promise<string> {
    const registrations = await this.prisma.registration.findMany({
      where: registrationWhere(filters),
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        registrationNumber: true,
        teamName: true,
        institution: true,
        status: true,
        updatedAt: true,
        competition: { select: { name: true } },
        _count: { select: { members: true } },
      },
    });

    const rows = registrations.map((registration) =>
      csvRow([
        registration.registrationNumber,
        registration.teamName,
        registration.institution,
        registration.competition.name,
        registration.status,
        registration._count.members,
        registration.updatedAt.toISOString(),
      ]),
    );
    return `\uFEFF${[
      csvRow([
        'Registration Number',
        'Team',
        'Institution',
        'Competition',
        'Status',
        'Member Count',
        'Updated At',
      ]),
      ...rows,
    ].join('\r\n')}\r\n`;
  }

  async review(
    actorId: string,
    id: string,
    dto: ReviewRegistrationDto,
    audit: AuditContext,
  ): Promise<SerializedAdminRegistration> {
    const reason = dto.reason?.trim() || null;
    if (
      (dto.status === RegistrationStatus.REVISION_REQUESTED ||
        dto.status === RegistrationStatus.REJECTED) &&
      !reason
    ) {
      throw new BadRequestException(
        'A reason is required for revision requests and rejections',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.registration.findUnique({
        where: { id },
        select: {
          status: true,
          reviewReason: true,
          reviewedAt: true,
          registrationNumber: true,
          teamName: true,
          owner: { select: { email: true, displayName: true } },
          competition: {
            select: { name: true, fee: true, currency: true },
          },
          invoice: { select: { id: true } },
        },
      });
      if (!current) throw new NotFoundException('Registration not found');

      assertRegistrationTransition(current.status, dto.status);
      if (dto.status === RegistrationStatus.APPROVED && current.invoice) {
        throw new BadRequestException(
          'Registration already has an invoice and cannot be approved again',
        );
      }

      const reviewedAt = new Date();
      const updated = await transaction.registration.updateMany({
        where: { id, status: current.status },
        data: {
          status: dto.status,
          reviewReason: reason,
          reviewedAt,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'Registration status changed before the review was saved',
        );
      }

      let createdInvoice: {
        id: string;
        invoiceNumber: string;
        paymentStatus: string;
        deadline: Date;
      } | null = null;

      if (dto.status === RegistrationStatus.APPROVED) {
        const deadline = paymentDeadline(reviewedAt);
        const order = await this.manualPayment.createOrder({
          registrationNumber: current.registrationNumber,
          amount: current.competition.fee,
          currency: current.competition.currency,
          deadline,
        });
        createdInvoice = await transaction.invoice.create({
          data: {
            registrationId: id,
            invoiceNumber: invoiceNumber(reviewedAt),
            amount: current.competition.fee,
            currency: current.competition.currency,
            provider: order.provider,
            instructions: order.instructions,
            paymentStatus: order.status,
            deadline,
          },
          select: {
            id: true,
            invoiceNumber: true,
            paymentStatus: true,
            deadline: true,
          },
        });

        await transaction.emailOutbox.create({
          data: {
            to: current.owner.email,
            subject: `Invoice pendaftaran ${current.registrationNumber}`,
            body: [
              `Halo ${current.owner.displayName},`,
              '',
              `Pendaftaran tim ${current.teamName} untuk ${current.competition.name} telah disetujui.`,
              `Nomor invoice: ${createdInvoice.invoiceNumber}`,
              `Jumlah: ${current.competition.currency} ${current.competition.fee}`,
              `Batas pembayaran: ${createdInvoice.deadline.toISOString()}`,
              `Referensi transfer: ${current.registrationNumber}`,
              '',
              'Silakan lihat instruksi pembayaran lengkap di portal peserta.',
              'Pembayaran dinyatakan lunas setelah diverifikasi oleh tim keuangan.',
            ].join('\n'),
          },
        });
      } else if (
        dto.status === RegistrationStatus.REVISION_REQUESTED ||
        dto.status === RegistrationStatus.REJECTED
      ) {
        const result =
          dto.status === RegistrationStatus.REVISION_REQUESTED
            ? 'memerlukan revisi'
            : 'ditolak';
        await transaction.emailOutbox.create({
          data: {
            to: current.owner.email,
            subject: `Status pendaftaran ${current.registrationNumber}`,
            body: [
              `Halo ${current.owner.displayName},`,
              '',
              `Pendaftaran tim ${current.teamName} ${result}.`,
              `Alasan: ${reason}`,
              '',
              dto.status === RegistrationStatus.REVISION_REQUESTED
                ? 'Silakan perbarui pendaftaran melalui portal peserta lalu kirim kembali.'
                : 'Silakan hubungi panitia jika memerlukan informasi lebih lanjut.',
            ].join('\n'),
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          actorId,
          action: REVIEW_ACTIONS[dto.status],
          entityType: 'Registration',
          entityId: id,
          before: {
            status: current.status,
            reviewReason: current.reviewReason,
            reviewedAt: current.reviewedAt?.toISOString() ?? null,
          },
          after: {
            status: dto.status,
            reviewReason: reason,
            reviewedAt: reviewedAt.toISOString(),
            ...(createdInvoice
              ? {
                  invoice: {
                    id: createdInvoice.id,
                    invoiceNumber: createdInvoice.invoiceNumber,
                    paymentStatus: createdInvoice.paymentStatus,
                    deadline: createdInvoice.deadline.toISOString(),
                  },
                }
              : {}),
          },
          reason,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
      });

      const registration = await transaction.registration.findUnique({
        where: { id },
        select: adminRegistrationSelect,
      });
      if (!registration) throw new NotFoundException('Registration not found');
      return serializeAdminRegistration(registration);
    });
  }

  async participantInvoice(
    ownerId: string,
    registrationId: string,
  ): Promise<SerializedInvoice> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { registrationId, registration: { ownerId } },
      select: invoiceSelect,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return serializeInvoice(invoice);
  }
}

@Roles(Role.REGISTRATION_REVIEWER, Role.SUPPORT)
@Controller('admin/registrations')
export class AdminRegistrationsController {
  constructor(private readonly registrations: AdminRegistrationsService) {}

  @Get()
  list(
    @Query() query: AdminRegistrationListDto,
  ): Promise<SerializedAdminRegistration[]> {
    return this.registrations.list(query);
  }

  @Get('export.csv')
  async exportCsv(
    @Query() query: AdminRegistrationFiltersDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="registrations.csv"; filename*=UTF-8''registrations.csv`,
    );
    return this.registrations.exportCsv(query);
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SerializedAdminRegistration> {
    return this.registrations.get(id);
  }

  @Roles(Role.REGISTRATION_REVIEWER)
  @Post(':id/review')
  review(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewRegistrationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SerializedAdminRegistration> {
    return this.registrations.review(user.id, id, dto, {
      requestId: request.requestId ?? randomUUID(),
      ipAddress: request.ip || request.socket.remoteAddress || null,
    });
  }
}

@Roles(Role.PARTICIPANT)
@Controller('registrations')
export class InvoiceController {
  constructor(private readonly registrations: AdminRegistrationsService) {}

  @Get(':id/invoice')
  getInvoice(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SerializedInvoice> {
    return this.registrations.participantInvoice(user.id, id);
  }
}
