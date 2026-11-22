import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  NestInterceptor,
  OnApplicationBootstrap,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JWT } from 'google-auth-library';
import { Observable, tap } from 'rxjs';
import { Roles } from './auth';
import { PrismaService } from './prisma.service';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DANGEROUS_SPREADSHEET_PREFIX = /^[=+\-@\t\r]/;

export interface GoogleSheetsSnapshot {
  registrations: Array<Array<string | number>>;
  attendance: Array<Array<string | number>>;
}

export interface GoogleSheetsStatus {
  enabled: boolean;
  spreadsheetUrl: string | null;
  syncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  registrationCount?: number;
  attendanceCount?: number;
}

export abstract class GoogleSheetsPublisher {
  abstract publish(snapshot: GoogleSheetsSnapshot): Promise<void>;
}

function spreadsheetId(): string {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? '';
}

function spreadsheetUrl(): string | null {
  const id = spreadsheetId();
  return id ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit` : null;
}

function sheetsEnabled(): boolean {
  return process.env.GOOGLE_SHEETS_ENABLED?.trim().toLowerCase() === 'true';
}

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

function parseServiceAccount(): ServiceAccountCredentials {
  const configured = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!configured) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured');
  const decoded = configured.startsWith('{')
    ? configured
    : Buffer.from(configured, 'base64').toString('utf8');
  const credentials = JSON.parse(decoded) as Partial<ServiceAccountCredentials>;
  if (typeof credentials.client_email !== 'string' || typeof credentials.private_key !== 'string') {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is invalid');
  }
  return credentials as ServiceAccountCredentials;
}

function safeCell(value: string | number | Date | null | undefined): string | number {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return value;
  return DANGEROUS_SPREADSHEET_PREFIX.test(value) ? `'${value}` : value;
}

@Injectable()
export class GoogleApiSheetsPublisher extends GoogleSheetsPublisher {
  async publish(snapshot: GoogleSheetsSnapshot): Promise<void> {
    const id = spreadsheetId();
    if (!id) throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not configured');

    const credentials = parseServiceAccount();
    const client = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [SHEETS_SCOPE],
    });
    const metadata = await client.request<{
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
    }>({
      url: `${SHEETS_API}/${encodeURIComponent(id)}?fields=sheets.properties(sheetId,title)`,
    });
    const sheets = metadata.data.sheets ?? [];
    const byTitle = new Map(
      sheets.map(({ properties }) => [properties?.title, properties?.sheetId] as const),
    );
    const requests: Array<Record<string, unknown>> = [];

    if (!byTitle.has('Pendaftaran')) {
      const first = sheets[0]?.properties;
      if (first?.sheetId !== undefined && first.title === 'Sheet1') {
        requests.push({
          updateSheetProperties: {
            properties: { sheetId: first.sheetId, title: 'Pendaftaran' },
            fields: 'title',
          },
        });
      } else {
        requests.push({ addSheet: { properties: { title: 'Pendaftaran' } } });
      }
    }
    if (!byTitle.has('Presensi')) {
      requests.push({ addSheet: { properties: { title: 'Presensi' } } });
    }
    if (requests.length > 0) {
      await client.request({
        url: `${SHEETS_API}/${encodeURIComponent(id)}:batchUpdate`,
        method: 'POST',
        data: { requests },
      });
    }

    await client.request({
      url: `${SHEETS_API}/${encodeURIComponent(id)}/values:batchClear`,
      method: 'POST',
      data: { ranges: ['Pendaftaran', 'Presensi'] },
    });
    await client.request({
      url: `${SHEETS_API}/${encodeURIComponent(id)}/values:batchUpdate`,
      method: 'POST',
      data: {
        valueInputOption: 'RAW',
        data: [
          { range: 'Pendaftaran!A1', majorDimension: 'ROWS', values: snapshot.registrations },
          { range: 'Presensi!A1', majorDimension: 'ROWS', values: snapshot.attendance },
        ],
      },
    });

    const refreshed = await client.request<{
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
    }>({
      url: `${SHEETS_API}/${encodeURIComponent(id)}?fields=sheets.properties(sheetId,title)`,
    });
    const formattingRequests = (refreshed.data.sheets ?? []).flatMap(({ properties }) => {
      if (properties?.sheetId === undefined || !['Pendaftaran', 'Presensi'].includes(properties.title ?? '')) {
        return [];
      }
      return [
        {
          updateSheetProperties: {
            properties: {
              sheetId: properties.sheetId,
              gridProperties: { frozenRowCount: 1 },
            },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          repeatCell: {
            range: { sheetId: properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.4, green: 0.08, blue: 0.11 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                wrapStrategy: 'WRAP',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy)',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId: properties.sheetId, dimension: 'COLUMNS' },
          },
        },
      ];
    });
    if (formattingRequests.length > 0) {
      await client.request({
        url: `${SHEETS_API}/${encodeURIComponent(id)}:batchUpdate`,
        method: 'POST',
        data: { requests: formattingRequests },
      });
    }
  }
}

@Injectable()
export class GoogleSheetsSyncService implements OnApplicationBootstrap {
  private currentSync: Promise<GoogleSheetsStatus> | null = null;
  private synchronizationRequested = false;
  private status: GoogleSheetsStatus = {
    enabled: sheetsEnabled(),
    spreadsheetUrl: spreadsheetUrl(),
    syncing: false,
    lastSyncedAt: null,
    lastError: null,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: GoogleSheetsPublisher,
  ) {}

  onApplicationBootstrap(): void {
    if (sheetsEnabled()) void this.queueSynchronization().catch(() => undefined);
  }

  getStatus(): GoogleSheetsStatus {
    return {
      ...this.status,
      enabled: sheetsEnabled(),
      spreadsheetUrl: spreadsheetUrl(),
      syncing: this.currentSync !== null,
    };
  }

  queueSynchronization(): Promise<GoogleSheetsStatus> {
    if (!sheetsEnabled()) return Promise.resolve(this.disabledStatus());
    this.synchronizationRequested = true;
    if (this.currentSync) return this.currentSync;
    this.status = { ...this.getStatus(), syncing: true, lastError: null };
    this.currentSync = this.processSynchronizationQueue()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Google Sheets synchronization failed';
        this.status = { ...this.getStatus(), syncing: false, lastError: message };
        throw error;
      })
      .finally(() => {
        this.currentSync = null;
      });
    return this.currentSync;
  }

  private async processSynchronizationQueue(): Promise<GoogleSheetsStatus> {
    do {
      this.synchronizationRequested = false;
      await this.performSynchronization();
    } while (this.synchronizationRequested);
    return this.getStatus();
  }

  synchronize(): Promise<GoogleSheetsStatus> {
    return this.queueSynchronization();
  }

  private disabledStatus(): GoogleSheetsStatus {
    this.status = {
      enabled: false,
      spreadsheetUrl: spreadsheetUrl(),
      syncing: false,
      lastSyncedAt: null,
      lastError: null,
    };
    return this.status;
  }

  private async performSynchronization(): Promise<GoogleSheetsStatus> {
    const registrations = await this.prisma.registration.findMany({
      orderBy: [{ registrationNumber: 'asc' }, { id: 'asc' }],
      select: {
        registrationNumber: true,
        teamName: true,
        institution: true,
        phone: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        updatedAt: true,
        owner: { select: { displayName: true, email: true } },
        competition: { select: { name: true } },
        invoice: { select: { paymentStatus: true } },
        ticket: {
          select: {
            kitHandedOverAt: true,
            kitHandedOverBy: { select: { displayName: true } },
          },
        },
        members: {
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
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

    const registrationRows: GoogleSheetsSnapshot['registrations'] = [[
      'Registration Number', 'Team', 'Institution', 'Competition', 'Owner Name',
      'Owner Email', 'Phone', 'Registration Status', 'Payment Status', 'Member Count',
      'Submitted At', 'Reviewed At', 'Updated At',
    ]];
    const attendanceRows: GoogleSheetsSnapshot['attendance'] = [[
      'Registration Number', 'Team', 'Competition', 'Institution', 'Role', 'Member Name',
      'Student ID', 'Attendance Status', 'Attended At', 'Attendance Operator',
      'JRC Kit Status', 'Kit Handed Over At', 'Kit Operator',
    ]];

    for (const registration of registrations) {
      registrationRows.push([
        safeCell(registration.registrationNumber),
        safeCell(registration.teamName),
        safeCell(registration.institution),
        safeCell(registration.competition.name),
        safeCell(registration.owner.displayName),
        safeCell(registration.owner.email),
        safeCell(registration.phone),
        safeCell(registration.status),
        safeCell(registration.invoice?.paymentStatus ?? 'NOT_CREATED'),
        registration.members.length,
        safeCell(registration.submittedAt),
        safeCell(registration.reviewedAt),
        safeCell(registration.updatedAt),
      ]);
      for (const member of registration.members) {
        attendanceRows.push([
          safeCell(registration.registrationNumber),
          safeCell(registration.teamName),
          safeCell(registration.competition.name),
          safeCell(registration.institution),
          safeCell(member.role),
          safeCell(member.name),
          safeCell(member.studentId),
          member.attendedAt ? 'ATTENDED' : 'NOT_ATTENDED',
          safeCell(member.attendedAt),
          safeCell(member.attendedBy?.displayName),
          registration.ticket?.kitHandedOverAt ? 'HANDED_OVER' : 'NOT_HANDED_OVER',
          safeCell(registration.ticket?.kitHandedOverAt),
          safeCell(registration.ticket?.kitHandedOverBy?.displayName),
        ]);
      }
    }

    await this.publisher.publish({ registrations: registrationRows, attendance: attendanceRows });
    this.status = {
      enabled: true,
      spreadsheetUrl: spreadsheetUrl(),
      syncing: false,
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      registrationCount: registrations.length,
      attendanceCount: Math.max(attendanceRows.length - 1, 0),
    };
    return this.status;
  }
}

const MUTATION_PATH = /^\/(?:api\/)?(?:registrations|admin\/registrations|admin\/participants|admin\/invoices|admin\/finance|invoices|gate)(?:\/|\?|$)/;

export function shouldQueueGoogleSheetsSync(method: string, path: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && MUTATION_PATH.test(path);
}

@Injectable()
export class GoogleSheetsMutationInterceptor implements NestInterceptor {
  constructor(private readonly sheets: GoogleSheetsSyncService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method?: string; originalUrl?: string; url?: string }>();
    const method = request.method ?? 'GET';
    const path = request.originalUrl ?? request.url ?? '';
    const shouldSynchronize = shouldQueueGoogleSheetsSync(method, path);
    return next.handle().pipe(tap(() => {
      if (shouldSynchronize) void this.sheets.queueSynchronization().catch(() => undefined);
    }));
  }
}

@Roles(
  Role.SUPER_ADMIN,
  Role.REGISTRATION_REVIEWER,
  Role.FINANCE,
  Role.GATE_STAFF,
  Role.SUPPORT,
)
@Controller('admin/google-sheets')
export class GoogleSheetsController {
  constructor(private readonly sheets: GoogleSheetsSyncService) {}

  @Get()
  status(): GoogleSheetsStatus {
    return this.sheets.getStatus();
  }

  @Post('sync')
  synchronize(): Promise<GoogleSheetsStatus> {
    return this.sheets.synchronize();
  }
}
