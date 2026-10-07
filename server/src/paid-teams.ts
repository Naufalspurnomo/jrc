import {
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Response } from 'express';
import { basename } from 'node:path';
import type { Readable } from 'node:stream';
import { Roles } from './auth';
import { PrismaService } from './prisma.service';
import { PrivateStorageService } from './private-storage';

const DEFAULT_PAGE_SIZE = 50;
const ALLOWED_FILE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export class PaidTeamListDto {
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
}

const paidTeamSelect = {
  verifiedAt: true,
  registration: {
    select: {
      id: true,
      registrationNumber: true,
      teamName: true,
      institution: true,
      competition: {
        select: {
          id: true,
          name: true,
          level: true,
          discipline: true,
        },
      },
    },
  },
} satisfies Prisma.InvoiceSelect;

const paidTeamDetailSelect = {
  invoiceNumber: true,
  amount: true,
  currency: true,
  verifiedAt: true,
  proofOriginalName: true,
  proofMimeType: true,
  proofSize: true,
  registration: {
    select: {
      id: true,
      registrationNumber: true,
      teamName: true,
      institution: true,
      phone: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { displayName: true, email: true } },
      competition: {
        select: {
          id: true,
          name: true,
          level: true,
          discipline: true,
          eventName: true,
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
        },
      },
      documents: {
        where: { category: 'MEMBER_PHOTO' },
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          category: true,
          originalName: true,
          mimeType: true,
          size: true,
          subjectName: true,
          subjectRole: true,
        },
      },
    },
  },
} satisfies Prisma.InvoiceSelect;

type PaidTeamInvoice = Prisma.InvoiceGetPayload<{ select: typeof paidTeamSelect }>;
type PaidTeamDetailInvoice = Prisma.InvoiceGetPayload<{
  select: typeof paidTeamDetailSelect;
}>;

export interface PaidTeamFileDownload {
  stream: Readable;
  originalName: string;
  mimeType: string;
  size: number;
}

function serializePaidTeam(invoice: PaidTeamInvoice) {
  return {
    ...invoice.registration,
    verifiedAt: invoice.verifiedAt?.toISOString() ?? null,
  };
}

function photoOwnerKey(name: string, role: string): string {
  const group = role === 'SUPERVISOR' ? 'SUPERVISOR' : 'PARTICIPANT';
  return `${group}:${name.trim().toLocaleLowerCase('id-ID')}`;
}

function serializePaidTeamDetail(invoice: PaidTeamDetailInvoice) {
  const registration = invoice.registration;
  const photos = new Map(
    registration.documents
      .filter((document) => document.subjectName && document.subjectRole)
      .map((document) => [
        photoOwnerKey(document.subjectName as string, document.subjectRole as string),
        document,
      ]),
  );
  const fileBase = `/api/admin/paid-teams/${encodeURIComponent(registration.id)}`;

  return {
    id: registration.id,
    registrationNumber: registration.registrationNumber,
    teamName: registration.teamName,
    institution: registration.institution,
    phone: registration.phone,
    status: registration.status,
    submittedAt: registration.submittedAt?.toISOString() ?? null,
    createdAt: registration.createdAt.toISOString(),
    updatedAt: registration.updatedAt.toISOString(),
    owner: registration.owner,
    competition: registration.competition,
    members: registration.members.map((member) => {
      const photo = photos.get(photoOwnerKey(member.name, member.role));
      return {
        ...member,
        photo: photo
          ? {
              id: photo.id,
              originalName: photo.originalName,
              mimeType: photo.mimeType,
              size: photo.size,
              viewUrl: `${fileBase}/photos/${encodeURIComponent(photo.id)}`,
              downloadUrl: `${fileBase}/photos/${encodeURIComponent(photo.id)}?download=true`,
            }
          : null,
      };
    }),
    payment: {
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      currency: invoice.currency,
      verifiedAt: invoice.verifiedAt?.toISOString() ?? null,
      proof: invoice.proofOriginalName && invoice.proofMimeType && invoice.proofSize !== null
        ? {
            originalName: invoice.proofOriginalName,
            mimeType: invoice.proofMimeType,
            size: invoice.proofSize,
            viewUrl: `${fileBase}/payment-proof`,
            downloadUrl: `${fileBase}/payment-proof?download=true`,
          }
        : null,
    },
  };
}

function safeOriginalName(originalName: string): string {
  const cleaned = basename(originalName.replaceAll('\\', '/'))
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .slice(0, 255);
  return cleaned || 'file';
}

function asFile(
  download: PaidTeamFileDownload,
  response: Response,
  attachment: boolean,
): StreamableFile {
  const safeName = safeOriginalName(download.originalName);
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  response.setHeader('Content-Type', download.mimeType);
  response.setHeader('Content-Length', String(download.size));
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader(
    'Content-Disposition',
    `${attachment ? 'attachment' : 'inline'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
  );
  return new StreamableFile(download.stream);
}

@Injectable()
export class PaidTeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateStorageService = new PrivateStorageService(),
  ) {}

  async list(query: PaidTeamListDto) {
    const search = query.query?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const invoices = await this.prisma.invoice.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        ...(search ? {
          OR: [
            { registration: { registrationNumber: { contains: search, mode: Prisma.QueryMode.insensitive } } },
            { registration: { teamName: { contains: search, mode: Prisma.QueryMode.insensitive } } },
            { registration: { institution: { contains: search, mode: Prisma.QueryMode.insensitive } } },
            { registration: { competition: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
          ],
        } : {}),
      },
      orderBy: [{ verifiedAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
      select: paidTeamSelect,
    });
    return {
      items: invoices.slice(0, pageSize).map(serializePaidTeam),
      page,
      pageSize,
      hasNextPage: invoices.length > pageSize,
    };
  }

  async detail(registrationId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { registrationId, paymentStatus: PaymentStatus.PAID },
      select: paidTeamDetailSelect,
    });
    if (!invoice) throw new NotFoundException('Paid team not found');
    return serializePaidTeamDetail(invoice);
  }

  async memberPhoto(
    registrationId: string,
    documentId: string,
  ): Promise<PaidTeamFileDownload> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { registrationId, paymentStatus: PaymentStatus.PAID },
      select: {
        registration: {
          select: {
            documents: {
              where: { id: documentId, category: 'MEMBER_PHOTO' },
              select: {
                storageKey: true,
                originalName: true,
                mimeType: true,
                size: true,
              },
            },
          },
        },
      },
    });
    const photo = invoice?.registration.documents[0];
    if (!photo || !['image/jpeg', 'image/png'].includes(photo.mimeType)) {
      throw new NotFoundException('Member photo not found');
    }
    return this.openFile(photo, 'Member photo not found');
  }

  async paymentProof(registrationId: string): Promise<PaidTeamFileDownload> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { registrationId, paymentStatus: PaymentStatus.PAID },
      select: {
        proofStorageKey: true,
        proofOriginalName: true,
        proofMimeType: true,
        proofSize: true,
      },
    });
    if (
      !invoice?.proofStorageKey ||
      !invoice.proofOriginalName ||
      !invoice.proofMimeType ||
      invoice.proofSize === null ||
      !ALLOWED_FILE_MIME_TYPES.has(invoice.proofMimeType)
    ) {
      throw new NotFoundException('Payment proof not found');
    }
    return this.openFile({
      storageKey: invoice.proofStorageKey,
      originalName: invoice.proofOriginalName,
      mimeType: invoice.proofMimeType,
      size: invoice.proofSize,
    }, 'Payment proof not found');
  }

  private async openFile(
    file: { storageKey: string; originalName: string; mimeType: string; size: number },
    notFoundMessage: string,
  ): Promise<PaidTeamFileDownload> {
    try {
      const stored = await this.storage.read(file.storageKey);
      if (stored.size !== file.size) {
        stored.stream.destroy();
        throw new NotFoundException(notFoundMessage);
      }
      return {
        stream: stored.stream,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException(notFoundMessage);
      }
      throw error;
    }
  }
}

@Roles(Role.PAID_TEAM_VIEWER)
@Controller('admin/paid-teams')
export class PaidTeamsController {
  constructor(private readonly paidTeams: PaidTeamsService) {}

  @Get()
  list(
    @Query() query: PaidTeamListDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    return this.paidTeams.list(query);
  }

  @Get(':registrationId')
  detail(
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    return this.paidTeams.detail(registrationId);
  }

  @Get(':registrationId/photos/:documentId')
  async memberPhoto(
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return asFile(
      await this.paidTeams.memberPhoto(registrationId, documentId),
      response,
      download === 'true',
    );
  }

  @Get(':registrationId/payment-proof')
  async paymentProof(
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return asFile(
      await this.paidTeams.paymentProof(registrationId),
      response,
      download === 'true',
    );
  }
}
