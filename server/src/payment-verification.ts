import {
  BadRequestException,
  Body,
  CallHandler,
  ConflictException,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  PayloadTooLargeException,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  RegistrationStatus,
  Role,
  TicketStatus,
} from '@prisma/client';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmod, lstat, mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Request, Response } from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { Observable } from 'rxjs';
import {
  AuthPrincipal,
  AuthenticatedRequest,
  CurrentUser,
  Roles,
} from './auth';
import {
  deriveTicketToken,
  hashTicketToken,
} from './common/ticket-token';
import { assertPaymentTransition } from './domain/payment-state';
import { PrismaService } from './prisma.service';

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const STORAGE_KEY_PATTERN = /^[a-f0-9]{64}$/;
const VERIFY_STATUSES = [PaymentStatus.PAID, PaymentStatus.REJECTED] as const;

type VerifyStatus = (typeof VERIFY_STATUSES)[number];

interface AuditContext {
  requestId: string;
  ipAddress: string | null;
}

interface UploadedProof {
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
}

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class VerifyPaymentDto {
  @IsIn([...VERIFY_STATUSES])
  status!: VerifyStatus;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  reason!: string;
}

function maxUploadBytes(): number {
  const raw = process.env.MAX_UPLOAD_BYTES?.trim();
  if (!raw) return DEFAULT_MAX_UPLOAD_BYTES;

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new InternalServerErrorException(
      'MAX_UPLOAD_BYTES must be a positive integer',
    );
  }
  return parsed;
}

function storageRoot(): string {
  const configured = process.env.STORAGE_PATH?.trim();
  if (!configured) {
    throw new InternalServerErrorException('STORAGE_PATH is required');
  }
  return resolve(configured);
}

function ticketSecret(): string {
  const secret = process.env.TICKET_SECRET ?? '';
  if (secret.length < 32) {
    throw new InternalServerErrorException(
      'TICKET_SECRET must contain at least 32 characters',
    );
  }
  return secret;
}

function buildVerificationUrl(token: string, eventId: string): string {
  const configured = process.env.PUBLIC_VERIFICATION_URL?.trim();
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new InternalServerErrorException(
      'PUBLIC_VERIFICATION_URL is required in production',
    );
  }

  let url: URL;
  try {
    url = new URL(configured || 'http://localhost:5173/ticket/verify');
  } catch {
    throw new InternalServerErrorException(
      'PUBLIC_VERIFICATION_URL must be a valid URL',
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InternalServerErrorException(
      'PUBLIC_VERIFICATION_URL must use http or https',
    );
  }
  if (url.username || url.password) {
    throw new InternalServerErrorException(
      'PUBLIC_VERIFICATION_URL must not contain credentials',
    );
  }

  url.searchParams.set('token', token);
  url.searchParams.set('eventId', eventId);
  return url.toString();
}

function safeOriginalName(originalName: string): string {
  const cleaned = basename(originalName)
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .slice(0, 255);
  return cleaned || 'payment-proof';
}

function hasPrefix(buffer: Buffer, prefix: readonly number[]): boolean {
  return (
    buffer.length >= prefix.length &&
    prefix.every((byte, index) => buffer[index] === byte)
  );
}

function validateProof(file: Express.Multer.File): void {
  const validMagic =
    (file.mimetype === 'image/png' &&
      hasPrefix(file.buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (file.mimetype === 'image/jpeg' &&
      hasPrefix(file.buffer, [0xff, 0xd8, 0xff])) ||
    (file.mimetype === 'application/pdf' &&
      hasPrefix(file.buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]));

  if (!validMagic) {
    throw new BadRequestException(
      'Payment proof must be a PNG, JPEG, or PDF with matching file content',
    );
  }
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

function serializeInvoice(invoice: InvoiceRecord) {
  const proof =
    invoice.proofOriginalName === null &&
    invoice.proofMimeType === null &&
    invoice.proofSize === null
      ? null
      : {
          originalName: invoice.proofOriginalName,
          mimeType: invoice.proofMimeType,
          size: invoice.proofSize,
        };

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    currency: invoice.currency,
    provider: invoice.provider,
    instructions: instructionsObject(invoice.instructions),
    paymentStatus: invoice.paymentStatus,
    deadline: invoice.deadline.toISOString(),
    proof,
    verificationReason: invoice.verificationReason,
    verifiedAt: invoice.verifiedAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

export type SerializedPaymentInvoice = ReturnType<typeof serializeInvoice>;

export interface ParticipantTicketResponse {
  token: string;
  verificationUrl: string;
  qrDataUrl: string;
  status: TicketStatus;
  teamName: string;
  registrationNumber: string;
  competitionName: string;
  eventName: string;
  issuedAt: string;
}

@Injectable()
export class PaymentProofUploadInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: maxUploadBytes(), files: 1 },
    }).single('file');

    await new Promise<void>((resolveUpload, rejectUpload) => {
      upload(request, response, (error: unknown) => {
        if (!error) {
          resolveUpload();
          return;
        }
        if (
          error instanceof multer.MulterError &&
          error.code === 'LIMIT_FILE_SIZE'
        ) {
          rejectUpload(
            new PayloadTooLargeException(
              `Payment proof exceeds ${maxUploadBytes()} bytes`,
            ),
          );
          return;
        }
        rejectUpload(new BadRequestException('Invalid multipart upload'));
      });
    });

    return next.handle();
  }
}

@Injectable()
export class PaymentVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadProof(
    ownerId: string,
    invoiceId: string,
    file: Express.Multer.File | undefined,
    audit: AuditContext,
  ): Promise<SerializedPaymentInvoice> {
    if (!file) throw new BadRequestException('Payment proof file is required');
    if (file.size > maxUploadBytes()) {
      throw new PayloadTooLargeException(
        `Payment proof exceeds ${maxUploadBytes()} bytes`,
      );
    }
    validateProof(file);

    const initial = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, registration: { ownerId } },
      select: {
        paymentStatus: true,
        deadline: true,
        proofStorageKey: true,
        proofOriginalName: true,
        proofMimeType: true,
        proofSize: true,
      },
    });
    if (!initial) throw new NotFoundException('Invoice not found');
    if (initial.deadline.getTime() <= Date.now()) {
      throw new BadRequestException('Invoice payment deadline has passed');
    }
    assertPaymentTransition(
      initial.paymentStatus,
      PaymentStatus.PENDING_VERIFICATION,
    );

    const stored = await this.storeProof(file);
    let result: SerializedPaymentInvoice;
    try {
      result = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.invoice.findFirst({
          where: { id: invoiceId, registration: { ownerId } },
          select: {
            paymentStatus: true,
            deadline: true,
            proofStorageKey: true,
            proofOriginalName: true,
            proofMimeType: true,
            proofSize: true,
            verificationReason: true,
            verifiedAt: true,
          },
        });
        if (!current) throw new NotFoundException('Invoice not found');
        const now = new Date();
        if (current.deadline <= now) {
          throw new BadRequestException('Invoice payment deadline has passed');
        }
        assertPaymentTransition(
          current.paymentStatus,
          PaymentStatus.PENDING_VERIFICATION,
        );

        const updated = await transaction.invoice.updateMany({
          where: {
            id: invoiceId,
            paymentStatus: current.paymentStatus,
            deadline: { gt: now },
            registration: { ownerId },
          },
          data: {
            paymentStatus: PaymentStatus.PENDING_VERIFICATION,
            proofStorageKey: stored.storageKey,
            proofOriginalName: stored.originalName,
            proofMimeType: stored.mimeType,
            proofSize: stored.size,
            verificationReason: null,
            verifiedAt: null,
            verifiedById: null,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'Invoice changed before the payment proof was saved',
          );
        }

        await transaction.auditLog.create({
          data: {
            actorId: ownerId,
            action: 'PAYMENT_PROOF_UPLOADED',
            entityType: 'Invoice',
            entityId: invoiceId,
            before: {
              paymentStatus: current.paymentStatus,
              proof: current.proofOriginalName
                ? {
                    originalName: current.proofOriginalName,
                    mimeType: current.proofMimeType,
                    size: current.proofSize,
                  }
                : null,
              verificationReason: current.verificationReason,
              verifiedAt: current.verifiedAt?.toISOString() ?? null,
            },
            after: {
              paymentStatus: PaymentStatus.PENDING_VERIFICATION,
              proof: {
                originalName: stored.originalName,
                mimeType: stored.mimeType,
                size: stored.size,
              },
              verificationReason: null,
              verifiedAt: null,
            },
            requestId: audit.requestId,
            ipAddress: audit.ipAddress,
          },
        });

        const invoice = await transaction.invoice.findUnique({
          where: { id: invoiceId },
          select: invoiceSelect,
        });
        if (!invoice) throw new NotFoundException('Invoice not found');
        return serializeInvoice(invoice);
      });
    } catch (error: unknown) {
      await this.removeStoredProof(stored.storageKey).catch(() => undefined);
      throw error;
    }

    if (
      initial.proofStorageKey &&
      initial.proofStorageKey !== stored.storageKey
    ) {
      await this.removeStoredProof(initial.proofStorageKey).catch(() => undefined);
    }
    return result;
  }

  async verify(
    actorId: string,
    invoiceId: string,
    dto: VerifyPaymentDto,
    audit: AuditContext,
  ): Promise<SerializedPaymentInvoice> {
    const reason = dto.reason.trim();
    const secret = dto.status === PaymentStatus.PAID ? ticketSecret() : null;

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          paymentStatus: true,
          verificationReason: true,
          verifiedAt: true,
          verifiedById: true,
          registration: {
            select: {
              id: true,
              status: true,
              registrationNumber: true,
              teamName: true,
              owner: { select: { email: true, displayName: true } },
              competition: { select: { name: true } },
            },
          },
        },
      });
      if (!current) throw new NotFoundException('Invoice not found');
      assertPaymentTransition(current.paymentStatus, dto.status);

      if (
        dto.status === PaymentStatus.PAID &&
        current.registration.status !== RegistrationStatus.APPROVED
      ) {
        throw new BadRequestException(
          'A ticket can only be issued for an approved registration',
        );
      }

      const verifiedAt = new Date();
      const updated = await transaction.invoice.updateMany({
        where: {
          id: invoiceId,
          paymentStatus: PaymentStatus.PENDING_VERIFICATION,
        },
        data: {
          paymentStatus: dto.status,
          verificationReason: reason,
          verifiedAt,
          verifiedById: actorId,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Invoice changed before payment verification was saved',
        );
      }

      let ticketId: string | null = null;
      if (dto.status === PaymentStatus.PAID) {
        ticketId = randomUUID();
        const token = deriveTicketToken(ticketId, secret!);
        await transaction.ticket.create({
          data: {
            id: ticketId,
            registrationId: current.registration.id,
            tokenHash: hashTicketToken(token),
            status: TicketStatus.ACTIVE,
          },
        });
      }

      const action =
        dto.status === PaymentStatus.PAID
          ? 'PAYMENT_MARKED_PAID'
          : 'PAYMENT_REJECTED';
      await transaction.auditLog.create({
        data: {
          actorId,
          action,
          entityType: 'Invoice',
          entityId: invoiceId,
          before: {
            paymentStatus: current.paymentStatus,
            verificationReason: current.verificationReason,
            verifiedAt: current.verifiedAt?.toISOString() ?? null,
            verifiedById: current.verifiedById,
          },
          after: {
            paymentStatus: dto.status,
            verificationReason: reason,
            verifiedAt: verifiedAt.toISOString(),
            verifiedById: actorId,
            ...(ticketId ? { ticketId } : {}),
          },
          reason,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
      });

      const paid = dto.status === PaymentStatus.PAID;
      await transaction.emailOutbox.create({
        data: {
          to: current.registration.owner.email,
          subject: paid
            ? `Pembayaran ${current.registration.registrationNumber} terverifikasi`
            : `Bukti pembayaran ${current.registration.registrationNumber} ditolak`,
          body: paid
            ? [
                `Halo ${current.registration.owner.displayName},`,
                '',
                `Pembayaran tim ${current.registration.teamName} untuk ${current.registration.competition.name} telah diverifikasi.`,
                'Tiket Anda telah diterbitkan dan tersedia di portal peserta.',
              ].join('\n')
            : [
                `Halo ${current.registration.owner.displayName},`,
                '',
                `Bukti pembayaran tim ${current.registration.teamName} ditolak.`,
                `Alasan: ${reason}`,
                'Silakan unggah bukti pembayaran baru melalui portal peserta.',
              ].join('\n'),
        },
      });

      const invoice = await transaction.invoice.findUnique({
        where: { id: invoiceId },
        select: invoiceSelect,
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      return serializeInvoice(invoice);
    });
  }

  async getTicket(
    ownerId: string,
    registrationId: string,
  ): Promise<ParticipantTicketResponse> {
    const registration = await this.prisma.registration.findFirst({
      where: { id: registrationId, ownerId },
      select: {
        teamName: true,
        registrationNumber: true,
        competition: {
          select: {
            name: true,
            eventId: true,
            eventName: true,
          },
        },
        ticket: {
          select: {
            id: true,
            tokenHash: true,
            status: true,
            issuedAt: true,
          },
        },
      },
    });
    if (!registration) throw new NotFoundException('Registration not found');
    if (
      !registration.ticket ||
      (registration.ticket.status !== TicketStatus.ACTIVE &&
        registration.ticket.status !== TicketStatus.CHECKED_IN)
    ) {
      throw new ConflictException('Ticket has not been issued');
    }

    const token = deriveTicketToken(registration.ticket.id, ticketSecret());
    const actualHash = Buffer.from(hashTicketToken(token), 'hex');
    const expectedHash = Buffer.from(registration.ticket.tokenHash, 'hex');
    if (
      actualHash.length !== expectedHash.length ||
      !timingSafeEqual(actualHash, expectedHash)
    ) {
      throw new InternalServerErrorException('Ticket integrity check failed');
    }

    const verificationUrl = buildVerificationUrl(
      token,
      registration.competition.eventId,
    );
    return {
      token,
      verificationUrl,
      qrDataUrl: await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        type: 'image/png',
      }),
      status: registration.ticket.status,
      teamName: registration.teamName,
      registrationNumber: registration.registrationNumber,
      competitionName: registration.competition.name,
      eventName: registration.competition.eventName,
      issuedAt: registration.ticket.issuedAt.toISOString(),
    };
  }

  private async storeProof(file: Express.Multer.File): Promise<UploadedProof> {
    const root = storageRoot();
    await mkdir(root, { recursive: true, mode: 0o700 });
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new InternalServerErrorException(
        'STORAGE_PATH must be a real directory',
      );
    }
    await chmod(root, 0o700);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const storageKey = randomBytes(32).toString('hex');
      try {
        await writeFile(join(root, storageKey), file.buffer, {
          flag: 'wx',
          mode: 0o600,
        });
        return {
          storageKey,
          originalName: safeOriginalName(file.originalname),
          mimeType: file.mimetype,
          size: file.size,
        };
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EEXIST' || attempt === 2) throw error;
      }
    }

    throw new InternalServerErrorException('Could not store payment proof');
  }

  private async removeStoredProof(storageKey: string): Promise<void> {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) return;
    try {
      await unlink(join(storageRoot(), storageKey));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

@Roles(Role.PARTICIPANT)
@Controller('invoices')
export class PaymentProofController {
  constructor(private readonly payments: PaymentVerificationService) {}

  @Post(':invoiceId/proof')
  @UseInterceptors(PaymentProofUploadInterceptor)
  uploadProof(
    @CurrentUser() user: AuthPrincipal,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<SerializedPaymentInvoice> {
    return this.payments.uploadProof(user.id, invoiceId, file, {
      requestId: request.requestId ?? randomUUID(),
      ipAddress: request.ip || request.socket.remoteAddress || null,
    });
  }
}

@Roles(Role.FINANCE)
@Controller('admin/invoices')
export class FinanceVerificationController {
  constructor(private readonly payments: PaymentVerificationService) {}

  @Post(':invoiceId/verify')
  verify(
    @CurrentUser() user: AuthPrincipal,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
    @Body() dto: VerifyPaymentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SerializedPaymentInvoice> {
    return this.payments.verify(user.id, invoiceId, dto, {
      requestId: request.requestId ?? randomUUID(),
      ipAddress: request.ip || request.socket.remoteAddress || null,
    });
  }
}

@Roles(Role.PARTICIPANT)
@Controller('registrations')
export class ParticipantTicketController {
  constructor(private readonly payments: PaymentVerificationService) {}

  @Get(':id/ticket')
  async getTicket(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ParticipantTicketResponse> {
    response.setHeader('Cache-Control', 'no-store');
    return this.payments.getTicket(user.id, id);
  }
}
