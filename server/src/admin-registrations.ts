import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Prisma, RegistrationStatus, Role } from '@prisma/client';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
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
  Matches,
  ValidateNested,
} from 'class-validator';
import { randomUUID } from 'node:crypto';

import {
  AuthPrincipal,
  AuthenticatedRequest,
  CurrentUser,
  Roles,
} from './auth';
import { assertRegistrationTransition } from './domain/registration-state';
import { ManualPaymentProvider } from './payments/manual-payment.provider';
import { PrismaService } from './prisma.service';
import { PrivateStorageService } from './private-storage';
import { encryptRichEmail } from './email-outbox';
import { buildRegistrationPortalUrl, renderTransactionalEmail } from './email-template';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimNullable = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized || null;
};

const REVIEW_STATUSES = [
  RegistrationStatus.UNDER_REVIEW,
  RegistrationStatus.APPROVED,
  RegistrationStatus.REVISION_REQUESTED,
  RegistrationStatus.REJECTED,
] as const;

const DELETABLE_STATUSES = [
  RegistrationStatus.DRAFT,
  RegistrationStatus.SUBMITTED,
  RegistrationStatus.UNDER_REVIEW,
  RegistrationStatus.REVISION_REQUESTED,
  RegistrationStatus.REJECTED,
  RegistrationStatus.CANCELLED,
] as const;

type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_REASON_CATEGORIES = ['DOCUMENT_INCOMPLETE','DOCUMENT_INVALID','DATA_MISMATCH','ELIGIBILITY','PAYMENT_OR_ADMINISTRATIVE','OTHER'] as const;
type ReviewReasonCategory = (typeof REVIEW_REASON_CATEGORIES)[number];

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
  reasonComment?: string;

  @IsOptional()
  @IsIn([...REVIEW_REASON_CATEGORIES])
  reasonCategory?: ReviewReasonCategory;
}

export class AdminRegistrationMemberEditDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  studentId?: string | null;

  @IsOptional()
  @Transform(trimNullable)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?[0-9][0-9 ()-]*[0-9]$/)
  phone?: string | null;
}

export class AdminEditRegistrationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  teamName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  institution?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => AdminRegistrationMemberEditDto)
  members?: AdminRegistrationMemberEditDto[];
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
  reviewReasonCategory: true,
  reviewReasonComment: true,
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
      subjectName: true,
      subjectRole: true,
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
    reviewReasonCategory: registration.reviewReasonCategory,
    reviewReasonComment: registration.reviewReasonComment,
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
      subjectName: document.subjectName,
      subjectRole: document.subjectRole,
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
    private readonly storage: PrivateStorageService = new PrivateStorageService(),
  ) {}

  async delete(
    actorId: string,
    id: string,
    audit: AuditContext,
  ): Promise<{ deleted: true; cleanupWarnings: string[] }> {
    const storageKeys = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.registration.findUnique({
        where: { id },
        select: {
          id: true,
          registrationNumber: true,
          teamName: true,
          status: true,
          owner: { select: { id: true, email: true, displayName: true } },
          documents: { select: { storageKey: true } },
          invoice: { select: { id: true } },
          ticket: { select: { id: true } },
        },
      });
      if (!current) throw new NotFoundException('Registration not found');
      if (
        !DELETABLE_STATUSES.includes(current.status as (typeof DELETABLE_STATUSES)[number]) ||
        current.invoice ||
        current.ticket
      ) {
        throw new BadRequestException('Registration is protected and cannot be deleted');
      }

      const deleted = await transaction.registration.deleteMany({
        where: { id, status: current.status, invoice: null, ticket: null },
      });
      if (deleted.count !== 1) {
        throw new BadRequestException('Registration changed before deletion was completed');
      }

      const documentStorageKeys = current.documents.map(({ storageKey }) => storageKey);
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'REGISTRATION_DELETED',
          entityType: 'Registration',
          entityId: id,
          before: {
            registrationNumber: current.registrationNumber,
            teamName: current.teamName,
            status: current.status,
            owner: current.owner,
            documentStorageKeys,
          },
          reason: 'Super Admin removed an eligible registration',
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
      });
      return documentStorageKeys;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const cleanupWarnings: string[] = [];
    for (const storageKey of storageKeys) {
      try {
        await this.storage.delete(storageKey);
      } catch {
        cleanupWarnings.push('Satu berkas privat gagal dibersihkan.');
      }
    }
    return { deleted: true, cleanupWarnings };
  }

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


  async edit(
    actorId: string,
    id: string,
    dto: AdminEditRegistrationDto,
    audit: AuditContext,
  ): Promise<SerializedAdminRegistration> {
    const hasRegistrationChange =
      dto.teamName !== undefined || dto.institution !== undefined || dto.phone !== undefined;
    const hasMemberChange = (dto.members?.length ?? 0) > 0;
    if (!hasRegistrationChange && !hasMemberChange) {
      throw new BadRequestException('At least one participant field must be changed');
    }

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.registration.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          teamName: true,
          institution: true,
          phone: true,
          members: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, studentId: true, role: true, email: true, phone: true },
          },
          invoice: { select: { id: true, paymentStatus: true } },
          ticket: { select: { id: true, status: true } },
        },
      });
      if (!current) throw new NotFoundException('Registration not found');

      const currentMemberIds = new Set(current.members.map((member) => member.id));
      const requestedMemberIds = dto.members?.map((member) => member.id) ?? [];
      if (new Set(requestedMemberIds).size !== requestedMemberIds.length) {
        throw new BadRequestException('A member may only be edited once per request');
      }
      if (requestedMemberIds.some((memberId) => !currentMemberIds.has(memberId))) {
        throw new NotFoundException('Member not found in this registration');
      }

      const before = {
        status: current.status,
        teamName: current.teamName,
        institution: current.institution,
        phone: current.phone,
        members: current.members,
        payment: current.invoice,
        ticket: current.ticket,
      };

      const registrationData: Prisma.RegistrationUpdateInput = {};
      if (dto.teamName !== undefined) registrationData.teamName = dto.teamName;
      if (dto.institution !== undefined) registrationData.institution = dto.institution;
      if (dto.phone !== undefined) registrationData.phone = dto.phone?.trim() || null;
      if (Object.keys(registrationData).length > 0) {
        const updated = await transaction.registration.updateMany({
          where: { id, status: current.status },
          data: registrationData,
        });
        if (updated.count !== 1) {
          throw new BadRequestException('Registration changed before the edit was saved');
        }
      }

      for (const member of dto.members ?? []) {
        const memberData: Prisma.TeamMemberUpdateManyMutationInput = {};
        if (member.name !== undefined) memberData.name = member.name;
        if (member.studentId !== undefined) memberData.studentId = member.studentId?.trim() || null;
        if (member.email !== undefined) memberData.email = member.email?.trim() || null;
        if (member.phone !== undefined) memberData.phone = member.phone?.trim() || null;
        if (Object.keys(memberData).length === 0) continue;
        const updated = await transaction.teamMember.updateMany({
          where: { id: member.id, registrationId: id },
          data: memberData,
        });
        if (updated.count !== 1) throw new NotFoundException('Member not found');
      }

      const updatedRegistration = await transaction.registration.findUnique({
        where: { id },
        select: adminRegistrationSelect,
      });
      if (!updatedRegistration) throw new NotFoundException('Registration not found');

      const after = {
        status: updatedRegistration.status,
        teamName: updatedRegistration.teamName,
        institution: updatedRegistration.institution,
        phone: updatedRegistration.phone,
        members: updatedRegistration.members.map((member) => ({
          id: member.id,
          name: member.name,
          studentId: member.studentId,
          role: member.role,
          email: member.email,
          phone: member.phone,
        })),
        payment: updatedRegistration.invoice
          ? { id: updatedRegistration.invoice.id, paymentStatus: updatedRegistration.invoice.paymentStatus }
          : null,
        ticket: updatedRegistration.ticket,
      };

      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'REGISTRATION_DATA_EDITED',
          entityType: 'Registration',
          entityId: id,
          before,
          after,
          reason: 'Admin corrected participant-submitted data without changing payment or ticket state',
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
      });

      return serializeAdminRegistration(updatedRegistration);
    });
  }

  async review(
    actorId: string,
    id: string,
    dto: ReviewRegistrationDto,
    audit: AuditContext,
  ): Promise<SerializedAdminRegistration> {
    const reasonComment = dto.reasonComment?.trim() || null;
    const reasonCategory = dto.reasonCategory ?? null;
    if (
      (dto.status === RegistrationStatus.REVISION_REQUESTED ||
        dto.status === RegistrationStatus.REJECTED) &&
      (!reasonComment || !reasonCategory)
    ) {
      throw new BadRequestException(
        'A reasonCategory and reasonComment are required for revision requests and rejections',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.registration.findUnique({
        where: { id },
        select: {
          status: true,
          reviewReasonCategory: true,
          reviewReasonComment: true,
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
          reviewReasonCategory: reasonCategory,
          reviewReasonComment: reasonComment,
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
            body: encryptRichEmail(renderTransactionalEmail({
              title: 'Pendaftaran disetujui', greetingName: current.owner.displayName,
              intro: 'Pendaftaran Anda telah disetujui. Selesaikan pembayaran sesuai informasi invoice berikut.', status: 'MENUNGGU PEMBAYARAN',
              details: [{ label: 'Tim', value: current.teamName }, { label: 'Kompetisi', value: current.competition.name }, { label: 'Nomor invoice', value: createdInvoice.invoiceNumber }, { label: 'Jumlah', value: `${current.competition.currency} ${current.competition.fee}` }, { label: 'Batas pembayaran', value: createdInvoice.deadline.toISOString() }, { label: 'Referensi transfer', value: current.registrationNumber }, { label: 'Bank', value: String(order.instructions.bankName) }, { label: 'Nama rekening', value: String(order.instructions.bankAccountName) }, { label: 'Nomor rekening', value: String(order.instructions.bankAccountNumber) }, ...(order.instructions.qrisImageUrl ? [{ label: 'QRIS', value: String(order.instructions.qrisImageUrl) }] : [])],
              paragraphs: ['Pembayaran baru dinyatakan lunas setelah rekonsiliasi oleh tim Finance.'], cta: { label: 'Buka portal pembayaran', url: buildRegistrationPortalUrl(id) },
            })),
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
            body: encryptRichEmail(renderTransactionalEmail({
              title: dto.status === RegistrationStatus.REVISION_REQUESTED ? 'Pendaftaran memerlukan revisi' : 'Pendaftaran ditolak', greetingName: current.owner.displayName,
              intro: `Pendaftaran tim ${current.teamName} ${result}.`, status: dto.status === RegistrationStatus.REVISION_REQUESTED ? 'PERLU REVISI' : 'DITOLAK',
              details: [{ label: 'Nomor pendaftaran', value: current.registrationNumber }, { label: 'Kategori alasan', value: reasonCategory ?? '' }, { label: 'Alasan', value: reasonComment ?? '' }],
              paragraphs: [dto.status === RegistrationStatus.REVISION_REQUESTED ? 'Perbarui data pendaftaran melalui portal peserta, lalu kirim kembali.' : 'Hubungi panitia jika Anda memerlukan informasi lebih lanjut.'],
              ...(dto.status === RegistrationStatus.REVISION_REQUESTED ? { cta: { label: 'Perbarui pendaftaran', url: buildRegistrationPortalUrl(id) } } : {}),
            })),
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
            reviewReasonCategory: current.reviewReasonCategory,
            reviewReasonComment: current.reviewReasonComment,
            reviewedAt: current.reviewedAt?.toISOString() ?? null,
          },
          after: {
            status: dto.status,
            reviewReasonCategory: reasonCategory,
          reviewReasonComment: reasonComment,
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
          reason: reasonCategory && reasonComment ? `${reasonCategory}: ${reasonComment}` : null,
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


  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SerializedAdminRegistration> {
    return this.registrations.get(id);
  }

  @Roles(Role.REGISTRATION_REVIEWER, Role.SUPPORT)
  @Patch(':id')
  editRegistration(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminEditRegistrationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SerializedAdminRegistration> {
    return this.registrations.edit(user.id, id, dto, {
      requestId: request.requestId ?? randomUUID(),
      ipAddress: request.ip || request.socket.remoteAddress || null,
    });
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

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  deleteRegistration(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ deleted: true; cleanupWarnings: string[] }> {
    return this.registrations.delete(user.id, id, {
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
