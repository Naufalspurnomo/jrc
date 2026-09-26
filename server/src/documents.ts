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
  Logger,
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
import { Prisma, Role, TeamMemberRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
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
import { PrivateStorageService } from './private-storage';

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DOCUMENT_CATEGORIES = new Set(['RECOMMENDATION_LETTER', 'IDENTITY_CARD', 'REGISTRATION_FORM', 'TEAM_PHOTO', 'TWIBBON_PROOF', 'MEMBER_PHOTO']);
const MEMBER_PHOTO_ROLES = new Set(['PARTICIPANT', 'SUPERVISOR']);

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
  subjectName: string | null;
  subjectRole: string | null;
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
  if (!DOCUMENT_CATEGORIES.has(normalized)) throw new BadRequestException('Unsupported document category');
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
    subjectName: document.subjectName,
    subjectRole: document.subjectRole,
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

interface ImageDimensions {
  width: number;
  height: number;
}

function pngDimensions(contents: Buffer): ImageDimensions | null {
  if (
    contents.length < 24 ||
    contents.readUInt32BE(8) !== 13 ||
    contents.toString('ascii', 12, 16) !== 'IHDR'
  ) return null;
  const width = contents.readUInt32BE(16);
  const height = contents.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegDimensions(contents: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset < contents.length) {
    if (contents[offset] !== 0xff) return null;
    while (offset < contents.length && contents[offset] === 0xff) offset += 1;
    if (offset >= contents.length) return null;
    const marker = contents[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > contents.length) return null;
    const segmentLength = contents.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > contents.length) return null;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      const height = contents.readUInt16BE(offset + 3);
      const width = contents.readUInt16BE(offset + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

/** Accept MEMBER_PHOTO images within 0.02 of the required 3:4 ratio. */
export function validateMemberPhotoAspectRatio(mimeType: string, contents: Buffer): void {
  const dimensions = mimeType === 'image/png'
    ? pngDimensions(contents)
    : mimeType === 'image/jpeg'
      ? jpegDimensions(contents)
      : null;
  if (!dimensions) {
    throw new BadRequestException('Member photo image dimensions could not be read');
  }
  if (Math.abs(dimensions.width / dimensions.height - 3 / 4) > 0.02) {
    throw new BadRequestException('Member photo must have a 3:4 portrait aspect ratio');
  }
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
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateStorageService = new PrivateStorageService(),
  ) {}

  async upload(
    ownerId: string,
    registrationId: string,
    category: string,
    subjectName: string | undefined,
    subjectRole: string | undefined,
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
    const normalizedSubjectName = subjectName?.trim() || null;
    const normalizedSubjectRole = subjectRole?.trim() || null;
    if (normalizedCategory === 'MEMBER_PHOTO') {
      if (!normalizedSubjectName || normalizedSubjectName.length > 150) throw new BadRequestException('Member photo requires a full participant name');
      if (!normalizedSubjectRole || !MEMBER_PHOTO_ROLES.has(normalizedSubjectRole)) throw new BadRequestException('Member photo role must be PARTICIPANT or SUPERVISOR');
      if (!['image/jpeg', 'image/png'].includes(file.mimetype)) throw new BadRequestException('Member photo must be a JPEG or PNG image');
      validateMemberPhotoAspectRatio(file.mimetype, file.buffer);
    } else if (normalizedSubjectName || normalizedSubjectRole) {
      throw new BadRequestException('Subject metadata is allowed only for member photos');
    }
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

        if (normalizedCategory === 'MEMBER_PHOTO') {
          const rosterRole = normalizedSubjectRole === 'SUPERVISOR'
            ? TeamMemberRole.SUPERVISOR
            : { in: [TeamMemberRole.LEADER, TeamMemberRole.MEMBER] };
          const rosterMember = await transaction.teamMember.findFirst({
            where: {
              registrationId,
              name: { equals: normalizedSubjectName as string, mode: Prisma.QueryMode.insensitive },
              role: rosterRole,
            },
            select: { id: true },
          });
          if (!rosterMember) {
            throw new BadRequestException('Member photo subject must match the registered roster');
          }
          const duplicate = await transaction.document.findFirst({
            where: {
              registrationId,
              category: 'MEMBER_PHOTO',
              subjectName: { equals: normalizedSubjectName as string, mode: Prisma.QueryMode.insensitive },
              subjectRole: normalizedSubjectRole,
            },
            select: { id: true },
          });
          if (duplicate) throw new BadRequestException('A member photo already exists for this roster person');
        }

        const created = await transaction.document.create({
          data: {
            registrationId,
            category: normalizedCategory,
            originalName: stored.originalName,
            mimeType: stored.mimeType,
            size: stored.size,
            storageKey: stored.storageKey,
            subjectName: normalizedSubjectName,
            subjectRole: normalizedSubjectRole,
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
      try {
        await this.removeStoredDocument(stored.storageKey);
      } catch {
        this.logger.error(
          'Failed to remove stored document after transaction rollback',
        );
      }
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
    return {
      storageKey: await this.storage.upload(file.buffer, file.mimetype),
      originalName: safeOriginalName(file.originalname),
      mimeType: file.mimetype,
      size: file.buffer.length,
    };
  }

  private async openDocument(document: DocumentRecord): Promise<DocumentDownload> {
    try {
      const stored = await this.storage.read(document.storageKey);
      if (stored.size !== document.size) {
        stored.stream.destroy();
        throw new NotFoundException('Document file not found');
      }
      return {
        stream: stored.stream,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('Document file not found');
      }
      throw error;
    }

  }

  private async removeStoredDocument(storageKey: string): Promise<void> {
    await this.storage.delete(storageKey);
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
    @Body('subjectName') subjectName: string | undefined,
    @Body('subjectRole') subjectRole: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<SerializedDocument> {
    return this.documents.upload(
      user.id,
      registrationId,
      category,
      subjectName,
      subjectRole,
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