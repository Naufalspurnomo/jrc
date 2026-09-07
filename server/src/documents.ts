import {
  BadRequestException,
  Body,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  HttpCode,
  HttpStatus,
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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { chmod, lstat, mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { Request, Response } from 'express';
import multer from 'multer';
import { Observable } from 'rxjs';
import {
  AuthPrincipal,
  AuthenticatedRequest,
  CurrentUser,
  Roles,
} from './auth';
import { canEditRegistration } from './domain/registration-state';
import { PrismaService } from './prisma.service';

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const DOCUMENT_SIGNATURES: Readonly<Record<string, readonly number[]>> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

interface AuditContext {
  requestId: string;
  ipAddress: string | null;
}

interface DocumentRecord {
  id: string;
  registrationId: string;
  category: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
}

interface StoredDocument {
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface DocumentDownload {
  stream: Readable;
  originalName: string;
  mimeType: string;
  size: number;
}

function maxUploadBytes(): number {
  const configured = process.env.MAX_UPLOAD_BYTES?.trim();
  if (!configured) return DEFAULT_MAX_UPLOAD_BYTES;

  const parsed = Number(configured);
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

function safeOriginalName(originalName: string): string {
  const cleaned = basename(originalName.replaceAll('\\', '/'))
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .slice(0, 255);
  return cleaned || 'document';
}

function normalizeCategory(category: string): string {
  const normalized = category.trim();
  if (!normalized) {
    throw new BadRequestException('Document category is required');
  }
  if (normalized.length > 100) {
    throw new BadRequestException('Document category must not exceed 100 characters');
  }
  return normalized;
}

function serializeDocument(document: DocumentRecord) {
  return {
    id: document.id,
    category: document.category,
    originalName: document.originalName,
    mimeType: document.mimeType,
    size: document.size,
    createdAt: document.createdAt.toISOString(),
  };
}

export type SerializedDocument = ReturnType<typeof serializeDocument>;

export function hasAllowedDocumentSignature(
  mimeType: string,
  contents: Uint8Array,
): boolean {
  const signature = DOCUMENT_SIGNATURES[mimeType];

  return (
    signature !== undefined &&
    contents.length >= signature.length &&
    signature.every((byte, index) => contents[index] === byte)
  );
}

export function resolveDocumentStoragePath(
  root: string,
  storageKey: string,
): string {
  if (!/^[0-9a-f]{64}$/.test(storageKey)) {
    throw new Error('Invalid document storage key');
  }

  const resolvedRoot = resolve(root);
  const storagePath = resolve(resolvedRoot, storageKey);

  if (dirname(storagePath) !== resolvedRoot) {
    throw new Error('Invalid document storage key');
  }

  return storagePath;
}

function validateDocument(file: Express.Multer.File): void {
  if (!hasAllowedDocumentSignature(file.mimetype, file.buffer)) {
    throw new BadRequestException(
      'Document must be a PNG, JPEG, or PDF with matching file content',
    );
  }
}

@Injectable()
export class DocumentUploadInterceptor implements NestInterceptor {
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
              `Document exceeds ${maxUploadBytes()} bytes`,
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
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(
    ownerId: string,
    registrationId: string,
    category: string,
    file: Express.Multer.File | undefined,
    audit: AuditContext,
  ): Promise<SerializedDocument> {
    const initial = await this.prisma.registration.findFirst({
      where: { id: registrationId, ownerId },
      select: { status: true },
    });
    if (!initial) throw new NotFoundException('Registration not found');
    if (!canEditRegistration(initial.status)) {
      throw new BadRequestException(
        'Registration is not editable in its current status',
      );
    }
    if (!file) throw new BadRequestException('Document file is required');
    if (file.buffer.length > maxUploadBytes()) {
      throw new PayloadTooLargeException(
        `Document exceeds ${maxUploadBytes()} bytes`,
      );
    }

    const normalizedCategory = normalizeCategory(category);
    validateDocument(file);
    const stored = await this.storeDocument(file);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.registration.findFirst({
          where: { id: registrationId, ownerId },
          select: { status: true },
        });
        if (!current) throw new NotFoundException('Registration not found');
        if (!canEditRegistration(current.status)) {
          throw new BadRequestException(
            'Registration is not editable in its current status',
          );
        }

        const created = await transaction.document.create({
          data: {
            registrationId,
            category: normalizedCategory,
            originalName: stored.originalName,
            mimeType: stored.mimeType,
            size: stored.size,
            storageKey: stored.storageKey,
          },
        });
        const serialized = serializeDocument(created);

        await transaction.auditLog.create({
          data: {
            actorId: ownerId,
            action: 'DOCUMENT_UPLOADED',
            entityType: 'Document',
            entityId: created.id,
            before: Prisma.JsonNull,
            after: serialized,
            requestId: audit.requestId,
            ipAddress: audit.ipAddress,
          },
        });

        return serialized;
      });
    } catch (error: unknown) {
      await this.removeStoredDocument(stored.storageKey);
      throw error;
    }
  }

  async getParticipantDocument(
    ownerId: string,
    registrationId: string,
    documentId: string,
  ): Promise<DocumentDownload> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        registrationId,
        registration: { ownerId },
      },
    });
    if (!document) throw new NotFoundException('Document not found');
    return this.openDocument(document);
  }

  async getAdminDocument(
    registrationId: string,
    documentId: string,
  ): Promise<DocumentDownload> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, registrationId },
    });
    if (!document) throw new NotFoundException('Document not found');
    return this.openDocument(document);
  }

  async delete(
    ownerId: string,
    registrationId: string,
    documentId: string,
    audit: AuditContext,
  ): Promise<void> {
    const storageKey = await this.prisma.$transaction(async (transaction) => {
      const registration = await transaction.registration.findFirst({
        where: { id: registrationId, ownerId },
        select: { status: true },
      });
      if (!registration) throw new NotFoundException('Registration not found');
      if (!canEditRegistration(registration.status)) {
        throw new BadRequestException(
          'Registration is not editable in its current status',
        );
      }

      const document = await transaction.document.findFirst({
        where: { id: documentId, registrationId },
      });
      if (!document) throw new NotFoundException('Document not found');

      const deleted = await transaction.document.deleteMany({
        where: { id: documentId, registrationId },
      });
      if (deleted.count !== 1) {
        throw new NotFoundException('Document not found');
      }

      await transaction.auditLog.create({
        data: {
          actorId: ownerId,
          action: 'DOCUMENT_DELETED',
          entityType: 'Document',
          entityId: documentId,
          before: serializeDocument(document),
          after: Prisma.JsonNull,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
      });

      return document.storageKey;
    });

    await this.removeStoredDocument(storageKey);
  }

  private async storeDocument(
    file: Express.Multer.File,
  ): Promise<StoredDocument> {
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
        await writeFile(resolveDocumentStoragePath(root, storageKey), file.buffer, {
          flag: 'wx',
          mode: 0o600,
        });
        return {
          storageKey,
          originalName: safeOriginalName(file.originalname),
          mimeType: file.mimetype,
          size: file.buffer.length,
        };
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EEXIST' || attempt === 2) throw error;
      }
    }

    throw new InternalServerErrorException('Could not store document');
  }

  private async openDocument(document: DocumentRecord): Promise<DocumentDownload> {
    const path = resolveDocumentStoragePath(storageRoot(), document.storageKey);
    try {
      const fileStat = await lstat(path);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
        throw new NotFoundException('Document file not found');
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('Document file not found');
      }
      throw error;
    }

    return {
      stream: createReadStream(path),
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
    };
  }

  private async removeStoredDocument(storageKey: string): Promise<void> {
    const path = resolveDocumentStoragePath(storageRoot(), storageKey);
    try {
      await unlink(path);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

function auditContext(request: AuthenticatedRequest): AuditContext {
  return {
    requestId: request.requestId ?? randomUUID(),
    ipAddress: request.ip || request.socket.remoteAddress || null,
  };
}

function asDownload(
  download: DocumentDownload,
  response: Response,
): StreamableFile {
  const asciiName = safeOriginalName(download.originalName).replace(
    /[^\x20-\x7e]/g,
    '_',
  );
  response.setHeader('Content-Type', download.mimeType);
  response.setHeader('Content-Length', String(download.size));
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiName.replace(/["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safeOriginalName(download.originalName))}`,
  );
  return new StreamableFile(download.stream);
}

@Roles(Role.PARTICIPANT)
@Controller('registrations')
export class ParticipantDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post(':registrationId/documents')
  @UseInterceptors(DocumentUploadInterceptor)
  upload(
    @CurrentUser() user: AuthPrincipal,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Body('category') category: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<SerializedDocument> {
    return this.documents.upload(
      user.id,
      registrationId,
      category,
      file,
      auditContext(request),
    );
  }

  @Get(':registrationId/documents/:documentId')
  async get(
    @CurrentUser() user: AuthPrincipal,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return asDownload(
      await this.documents.getParticipantDocument(
        user.id,
        registrationId,
        documentId,
      ),
      response,
    );
  }

  @Delete(':registrationId/documents/:documentId')
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUser() user: AuthPrincipal,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ success: true }> {
    await this.documents.delete(
      user.id,
      registrationId,
      documentId,
      auditContext(request),
    );
    return { success: true };
  }
}

@Roles(Role.REGISTRATION_REVIEWER, Role.SUPPORT)
@Controller('admin/registrations')
export class AdminDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get(':registrationId/documents/:documentId')
  async get(
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return asDownload(
      await this.documents.getAdminDocument(registrationId, documentId),
      response,
    );
  }
}