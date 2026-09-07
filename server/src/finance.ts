import {
  Controller,
  Get,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Response } from 'express';
import { Roles } from './auth';
import { PrismaService } from './prisma.service';

const DEFAULT_PAGE_SIZE = 50;
const STORAGE_KEY_PATTERN = /^[0-9a-f]{64}$/;
const ALLOWED_PROOF_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export class FinanceInvoiceListDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsUUID()
  competitionId?: string;

  @IsOptional()
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

const financeInvoiceSelect = {
  id: true,
  invoiceNumber: true,
  amount: true,
  currency: true,
  paymentStatus: true,
  deadline: true,
  proofOriginalName: true,
  proofMimeType: true,
  proofSize: true,
  verificationReason: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
  registration: {
    select: {
      id: true,
      registrationNumber: true,
      teamName: true,
      institution: true,
      owner: { select: { displayName: true } },
      competition: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.InvoiceSelect;

type FinanceInvoiceRecord = Prisma.InvoiceGetPayload<{
  select: typeof financeInvoiceSelect;
}>;

export function serializeFinanceInvoice(invoice: FinanceInvoiceRecord) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    currency: invoice.currency,
    paymentStatus: invoice.paymentStatus,
    deadline: invoice.deadline.toISOString(),
    proof:
      invoice.proofOriginalName === null &&
      invoice.proofMimeType === null &&
      invoice.proofSize === null
        ? null
        : {
            originalName: invoice.proofOriginalName,
            mimeType: invoice.proofMimeType,
            size: invoice.proofSize,
          },
    verificationReason: invoice.verificationReason,
    verifiedAt: invoice.verifiedAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    registration: invoice.registration,
  };
}

export type SerializedFinanceInvoice = ReturnType<
  typeof serializeFinanceInvoice
>;

interface ProofRecord {
  path: string;
  mimeType: string;
  size: number;
}

function storageRoot(): string {
  const configured = process.env.STORAGE_PATH?.trim();
  if (!configured) {
    throw new InternalServerErrorException('STORAGE_PATH is required');
  }
  return resolve(configured);
}

function proofPath(storageKey: string): string {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) {
    throw new InternalServerErrorException('Invalid payment proof storage key');
  }
  const root = storageRoot();
  const path = resolve(root, storageKey);
  if (dirname(path) !== root) {
    throw new InternalServerErrorException('Invalid payment proof storage key');
  }
  return path;
}

function invoiceWhere(query: FinanceInvoiceListDto): Prisma.InvoiceWhereInput {
  const search = query.query?.trim();
  return {
    paymentStatus: query.status ?? PaymentStatus.PENDING_VERIFICATION,
    ...(query.competitionId
      ? { registration: { competitionId: query.competitionId } }
      : {}),
    ...(search
      ? {
          OR: [
            {
              invoiceNumber: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              registration: {
                registrationNumber: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
            {
              registration: {
                teamName: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          ],
        }
      : {}),
  };
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: FinanceInvoiceListDto,
  ): Promise<SerializedFinanceInvoice[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? query.limit ?? DEFAULT_PAGE_SIZE;
    const invoices = await this.prisma.invoice.findMany({
      where: invoiceWhere(query),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: financeInvoiceSelect,
    });
    return invoices.map(serializeFinanceInvoice);
  }

  async proof(invoiceId: string): Promise<ProofRecord> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        proofStorageKey: true,
        proofMimeType: true,
        proofSize: true,
      },
    });
    if (
      !invoice?.proofStorageKey ||
      !invoice.proofMimeType ||
      invoice.proofSize === null
    ) {
      throw new NotFoundException('Payment proof not found');
    }
    if (!ALLOWED_PROOF_MIME_TYPES.has(invoice.proofMimeType)) {
      throw new InternalServerErrorException('Invalid payment proof MIME type');
    }

    const path = proofPath(invoice.proofStorageKey);
    try {
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== invoice.proofSize) {
        throw new NotFoundException('Payment proof not found');
      }
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('Payment proof not found');
      }
      throw error;
    }

    return { path, mimeType: invoice.proofMimeType, size: invoice.proofSize };
  }
}

@Roles(Role.FINANCE)
@Controller('admin/finance/invoices')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  list(
    @Query() query: FinanceInvoiceListDto,
  ): Promise<SerializedFinanceInvoice[]> {
    return this.finance.list(query);
  }

  @Get(':invoiceId/proof')
  async proof(
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const proof = await this.finance.proof(invoiceId);
    response.setHeader('Content-Type', proof.mimeType);
    response.setHeader('Content-Length', String(proof.size));
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(createReadStream(proof.path));
  }
}
