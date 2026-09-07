import { RegistrationStatus, Role } from '@prisma/client';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../src/auth';
import {
  AdminDocumentsController,
  DocumentsService,
} from '../src/documents';
import { PrismaService } from '../src/prisma.service';

const ORIGINAL_ENV = { ...process.env };
const REGISTRATION_ID = '18a46e52-63ee-439d-8a77-280f126d82e6';
const DOCUMENT_ID = '4fe8fb90-e44b-42c4-a4c4-4c671f1e34c6';
const OWNER_ID = '048ed71f-fbf0-414a-96d2-9f625847002e';
const STORAGE_KEY = 'a'.repeat(64);
const CREATED_AT = new Date('2026-09-07T12:34:56.000Z');

function uploadFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  const buffer = Buffer.from('%PDF-test');
  return {
    fieldname: 'file',
    originalname: '../student-card.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

function documentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: DOCUMENT_ID,
    registrationId: REGISTRATION_ID,
    category: 'STUDENT_CARD',
    originalName: 'student-card.pdf',
    mimeType: 'application/pdf',
    size: Buffer.byteLength('%PDF-test'),
    storageKey: STORAGE_KEY,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

describe('DocumentsService', () => {
  let sandbox: string;
  let storagePath: string;

  beforeEach(async () => {
    sandbox = await import('node:fs/promises').then(({ mkdtemp }) =>
      mkdtemp(join(tmpdir(), 'jrc-documents-')),
    );
    storagePath = join(sandbox, 'private');
    process.env.STORAGE_PATH = storagePath;
    process.env.MAX_UPLOAD_BYTES = '1024';
  });

  afterEach(async () => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    await rm(sandbox, { recursive: true, force: true });
  });

  it('stores a validated upload privately and returns only safe metadata', async () => {
    const created = documentRecord({ storageKey: 'b'.repeat(64) });
    const transaction = {
      registration: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ status: RegistrationStatus.DRAFT }),
      },
      document: { create: vi.fn().mockResolvedValue(created) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      registration: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ status: RegistrationStatus.DRAFT }),
      },
      $transaction: vi.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };
    const service = new DocumentsService(prisma as unknown as PrismaService);

    const result = await service.upload(
      OWNER_ID,
      REGISTRATION_ID,
      ' STUDENT_CARD ',
      uploadFile(),
      { requestId: 'request-id', ipAddress: '127.0.0.1' },
    );

    expect(result).toEqual({
      id: DOCUMENT_ID,
      category: 'STUDENT_CARD',
      originalName: 'student-card.pdf',
      mimeType: 'application/pdf',
      size: Buffer.byteLength('%PDF-test'),
      createdAt: CREATED_AT.toISOString(),
    });
    expect(result).not.toHaveProperty('storageKey');
    const files = await readdir(storagePath);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[0-9a-f]{64}$/);
    expect((await stat(storagePath)).mode & 0o777).toBe(0o700);
    expect((await stat(join(storagePath, files[0]))).mode & 0o777).toBe(
      0o600,
    );
    expect(await readFile(join(storagePath, files[0]))).toEqual(
      uploadFile().buffer,
    );
    expect(transaction.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          registrationId: REGISTRATION_ID,
          category: 'STUDENT_CARD',
          storageKey: files[0],
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: OWNER_ID,
          action: 'DOCUMENT_UPLOADED',
          entityType: 'Document',
          entityId: DOCUMENT_ID,
          requestId: 'request-id',
        }),
      }),
    );
  });

  it('removes the stored file when the database transaction fails', async () => {
    const prisma = {
      registration: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ status: RegistrationStatus.DRAFT }),
      },
      $transaction: vi.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const service = new DocumentsService(prisma as unknown as PrismaService);

    await expect(
      service.upload(
        OWNER_ID,
        REGISTRATION_ID,
        'STUDENT_CARD',
        uploadFile(),
        { requestId: 'request-id', ipAddress: null },
      ),
    ).rejects.toThrow('database unavailable');
    expect(await readdir(storagePath)).toEqual([]);
  });

  it('returns 404 for a registration not owned by the participant', async () => {
    const prisma = {
      registration: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new DocumentsService(prisma as unknown as PrismaService);

    await expect(
      service.upload(
        OWNER_ID,
        REGISTRATION_ID,
        'STUDENT_CARD',
        uploadFile(),
        { requestId: 'request-id', ipAddress: null },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(stat(storagePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects uploads when the registration is not editable', async () => {
    const prisma = {
      registration: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ status: RegistrationStatus.SUBMITTED }),
      },
    };
    const service = new DocumentsService(prisma as unknown as PrismaService);

    await expect(
      service.upload(
        OWNER_ID,
        REGISTRATION_ID,
        'STUDENT_CARD',
        uploadFile(),
        { requestId: 'request-id', ipAddress: null },
      ),
    ).rejects.toThrow('Registration is not editable in its current status');
  });

  it('rejects MIME and magic-byte mismatches', async () => {
    const prisma = {
      registration: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ status: RegistrationStatus.DRAFT }),
      },
    };
    const service = new DocumentsService(prisma as unknown as PrismaService);

    await expect(
      service.upload(
        OWNER_ID,
        REGISTRATION_ID,
        'STUDENT_CARD',
        uploadFile({ mimetype: 'image/png' }),
        { requestId: 'request-id', ipAddress: null },
      ),
    ).rejects.toThrow(
      'Document must be a PNG, JPEG, or PDF with matching file content',
    );
  });

  it('opens an owned document from its contained opaque storage path', async () => {
    await mkdir(storagePath, { recursive: true, mode: 0o700 });
    await writeFile(join(storagePath, STORAGE_KEY), '%PDF-test', { mode: 0o600 });
    const prisma = {
      document: {
        findFirst: vi.fn().mockResolvedValue(documentRecord()),
      },
    };
    const service = new DocumentsService(prisma as unknown as PrismaService);

    const download = await service.getParticipantDocument(
      OWNER_ID,
      REGISTRATION_ID,
      DOCUMENT_ID,
    );
    const chunks: Buffer[] = [];
    for await (const chunk of download.stream) chunks.push(Buffer.from(chunk));

    expect(Buffer.concat(chunks).toString()).toBe('%PDF-test');
    expect(download).toMatchObject({
      originalName: 'student-card.pdf',
      mimeType: 'application/pdf',
      size: Buffer.byteLength('%PDF-test'),
    });
  });

  it('deletes the database record and audit before removing the stored file', async () => {
    await mkdir(storagePath, { recursive: true, mode: 0o700 });
    await writeFile(join(storagePath, STORAGE_KEY), '%PDF-test', { mode: 0o600 });
    const transaction = {
      registration: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ status: RegistrationStatus.REVISION_REQUESTED }),
      },
      document: { findFirst: vi.fn().mockResolvedValue(documentRecord()) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      documentDelete: vi.fn(),
    };
    const deleteMany = vi.fn().mockImplementation(() => {
      transaction.documentDelete();
      return Promise.resolve({ count: 1 });
    });
    Object.assign(transaction.document, { deleteMany });
    const prisma = {
      $transaction: vi.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };
    const service = new DocumentsService(prisma as unknown as PrismaService);

    await service.delete(
      OWNER_ID,
      REGISTRATION_ID,
      DOCUMENT_ID,
      { requestId: 'request-id', ipAddress: null },
    );

    expect(transaction.documentDelete).toHaveBeenCalledOnce();
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DOCUMENT_DELETED',
          entityId: DOCUMENT_ID,
        }),
      }),
    );
    await expect(stat(join(storagePath, STORAGE_KEY))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

describe('AdminDocumentsController authorization metadata', () => {
  it('allows registration reviewers and support staff', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminDocumentsController)).toEqual([
      Role.REGISTRATION_REVIEWER,
      Role.SUPPORT,
    ]);
  });
});