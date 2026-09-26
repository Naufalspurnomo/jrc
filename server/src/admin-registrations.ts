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
import ExcelJS from 'exceljs';
import { Response } from 'express';
import {
  AuthPrincipal,
  AuthenticatedRequest,
  CurrentUser,
  Roles,
} from './auth';
import { assertRegistrationTransition } from './domain/registration-state';
import { ManualPaymentProvider } from './payments/manual-payment.provider';
import { PrismaService } from './prisma.service';
import { encryptRichEmail } from './email-outbox';
import { buildRegistrationPortalUrl, renderTransactionalEmail } from './email-template';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const REVIEW_STATUSES = [
  RegistrationStatus.UNDER_REVIEW,
  RegistrationStatus.APPROVED,
  RegistrationStatus.REVISION_REQUESTED,
  RegistrationStatus.REJECTED,
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

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLSX_DATE_FORMAT = 'yyyy-mm-dd hh:mm:ss';
const DANGEROUS_SPREADSHEET_PREFIX = /^[=+\-@\t\r]/;

function safeSpreadsheetString(value: string): string {
  return DANGEROUS_SPREADSHEET_PREFIX.test(value) ? `'${value}` : value;
}

function safeSpreadsheetValue(
  value: string | number | Date | null,
): string | number | Date | null {
  return typeof value === 'string' ? safeSpreadsheetString(value) : value;
}

function createExportWorkbook(
  sheetName: string,
  headers: string[],
  widths: number[],
): { workbook: ExcelJS.Workbook; worksheet: ExcelJS.Worksheet } {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JRC XIV Administration';
  workbook.lastModifiedBy = 'JRC XIV Administration';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = `${sheetName} - JRC XIV`;
  workbook.subject = `JRC XIV ${sheetName.toLowerCase()} export`;
  workbook.company = 'JRC XIV';
  workbook.keywords = 'JRC XIV administration export';

  const worksheet = workbook.addWorksheet(sheetName, {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  worksheet.columns = headers.map((header, index) => ({
    header,
    key: `column${index + 1}`,
    width: widths[index],
    style: { alignment: { vertical: 'middle', wrapText: true } },
  }));
  const header = worksheet.getRow(1);
  header.height = 30;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF67151D' },
  };
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  return { workbook, worksheet };
}

function finishExportWorksheet(worksheet: ExcelJS.Worksheet): void {
  const lastRow = Math.max(worksheet.rowCount, 1);
  const lastColumn = worksheet.columnCount;
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastRow, column: lastColumn },
  };
  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (rowNumber > 1 && rowNumber % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8F3F3' },
      };
    }
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9C7C9' } },
        left: { style: 'thin', color: { argb: 'FFD9C7C9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9C7C9' } },
        right: { style: 'thin', color: { argb: 'FFD9C7C9' } },
      };
    });
  }
}

async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

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

  async exportXlsx(filters: AdminRegistrationFiltersDto): Promise<Buffer> {
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
    const { workbook, worksheet } = createExportWorkbook(
      'Registrations',
      [
        'Registration Number', 'Team', 'Institution', 'Competition', 'Status',
        'Member Count', 'Updated At',
      ],
      [24, 28, 32, 28, 22, 15, 22],
    );
    for (const registration of registrations) {
      const row = worksheet.addRow([
        registration.registrationNumber,
        registration.teamName,
        registration.institution,
        registration.competition.name,
        registration.status,
        registration._count.members,
        registration.updatedAt,
      ].map((value) => safeSpreadsheetValue(value)));
      row.getCell(7).numFmt = XLSX_DATE_FORMAT;
      row.getCell(5).font = { bold: true, color: { argb: 'FF67151D' } };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    }
    finishExportWorksheet(worksheet);
    return workbookBuffer(workbook);
  }

  async exportAttendanceXlsx(filters: AdminRegistrationFiltersDto): Promise<Buffer> {
    const registrations = await this.prisma.registration.findMany({
      where: registrationWhere({
        ...filters,
        status: filters.status ?? RegistrationStatus.APPROVED,
      }),
      orderBy: { registrationNumber: 'asc' },
      select: {
        registrationNumber: true, teamName: true, institution: true,
        competition: { select: { name: true } },
        ticket: { select: { kitHandedOverAt: true, kitHandedOverBy: { select: { displayName: true } } } },
        members: {
          orderBy: [
            { role: 'asc' },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
          select: {
            role: true,
            name: true,
            studentId: true,
            attendedAt: true,
            attendedBy: { select: { displayName: true } },
          },
        },
      },
    });
    const { workbook, worksheet } = createExportWorkbook(
      'Attendance',
      [
        'Registration Number', 'Team', 'Competition', 'Institution', 'Role',
        'Member Name', 'Student ID', 'Attendance Status', 'Attended At',
        'Attendance Operator', 'JRC Kit Status', 'Kit Handed Over At', 'Kit Operator',
      ],
      [24, 28, 28, 30, 16, 26, 18, 20, 22, 24, 22, 22, 24],
    );
    for (const registration of registrations) {
      for (const member of registration.members) {
        const row = worksheet.addRow([
          registration.registrationNumber, registration.teamName,
          registration.competition.name, registration.institution, member.role,
          member.name, member.studentId ?? '',
          member.attendedAt ? 'ATTENDED' : 'NOT_ATTENDED', member.attendedAt,
          member.attendedBy?.displayName ?? '',
          registration.ticket?.kitHandedOverAt ? 'HANDED_OVER' : 'NOT_HANDED_OVER',
          registration.ticket?.kitHandedOverAt ?? null,
          registration.ticket?.kitHandedOverBy?.displayName ?? '',
        ].map((value) => safeSpreadsheetValue(value)));
        row.getCell(9).numFmt = XLSX_DATE_FORMAT;
        row.getCell(12).numFmt = XLSX_DATE_FORMAT;
        for (const column of [5, 8, 11]) {
          row.getCell(column).font = { bold: true, color: { argb: 'FF67151D' } };
        }
      }
    }
    finishExportWorksheet(worksheet);
    return workbookBuffer(workbook);
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

  @Get('export.xlsx')
  async exportXlsx(
    @Query() query: AdminRegistrationFiltersDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Buffer> {
    response.setHeader('Content-Type', XLSX_MIME);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="registrations-jrc-xiv.xlsx"; filename*=UTF-8''registrations-jrc-xiv.xlsx`,
    );
    return this.registrations.exportXlsx(query);
  }

  @Get('attendance.xlsx')
  async exportAttendanceXlsx(
    @Query() query: AdminRegistrationFiltersDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Buffer> {
    response.setHeader('Content-Type', XLSX_MIME);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-jrc-xiv.xlsx"; filename*=UTF-8''attendance-jrc-xiv.xlsx`,
    );
    return this.registrations.exportAttendanceXlsx(query);
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
