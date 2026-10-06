import { Controller, Get, Injectable, Query, Res } from '@nestjs/common';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Response } from 'express';
import { Roles } from './auth';
import { PrismaService } from './prisma.service';

const DEFAULT_PAGE_SIZE = 50;

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

type PaidTeamInvoice = Prisma.InvoiceGetPayload<{ select: typeof paidTeamSelect }>;

function serializePaidTeam(invoice: PaidTeamInvoice) {
  return {
    ...invoice.registration,
    verifiedAt: invoice.verifiedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class PaidTeamsService {
  constructor(private readonly prisma: PrismaService) {}

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
}