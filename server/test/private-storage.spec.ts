import { lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrivateStorageService } from '../src/private-storage';

const ORIGINAL_ENV = { ...process.env };

async function streamContents(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

afterEach(async () => {
  const path = process.env.STORAGE_PATH;
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (path?.startsWith(tmpdir())) await rm(path, { recursive: true, force: true });
});

describe('PrivateStorageService local driver', () => {
  it('remains the default and writes, reads, and deletes opaque objects', async () => {
    const root = join(tmpdir(), `jrc-storage-${crypto.randomUUID()}`);
    process.env.STORAGE_PATH = root;
    delete process.env.STORAGE_DRIVER;
    const storage = new PrivateStorageService();

    const key = await storage.upload(Buffer.from('private'), 'application/pdf');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(await readFile(join(root, key), 'utf8')).toBe('private');
    expect((await lstat(root)).mode & 0o777).toBe(0o700);
    expect((await lstat(join(root, key))).mode & 0o777).toBe(0o600);
    const stored = await storage.read(key);
    expect(stored.size).toBe(7);
    expect((await streamContents(stored.stream)).toString()).toBe('private');
    await storage.delete(key);
    await expect(readFile(join(root, key))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it('opens objects without following symlinks', async () => {
    const root = join(tmpdir(), `jrc-storage-${crypto.randomUUID()}`);
    const target = join(tmpdir(), `jrc-storage-target-${crypto.randomUUID()}`);
    const key = 'a'.repeat(64);
    await mkdir(root);
    await writeFile(target, 'secret');
    await symlink(target, join(root, key));
    process.env.STORAGE_PATH = root;

    await expect(new PrivateStorageService().read(key)).rejects.toMatchObject({
      code: expect.stringMatching(/^(ELOOP|ENOENT)$/),
    });
    await rm(target, { force: true });
  });

  it('rejects a symlink storage root', async () => {
    const target = join(tmpdir(), `jrc-storage-target-${crypto.randomUUID()}`);
    const root = join(tmpdir(), `jrc-storage-link-${crypto.randomUUID()}`);
    await mkdir(target);
    await symlink(target, root);
    process.env.STORAGE_PATH = root;

    await expect(
      new PrivateStorageService().upload(Buffer.from('private'), 'application/pdf'),
    ).rejects.toThrow('STORAGE_PATH must be a real directory');
  });
});

describe('PrivateStorageService Supabase driver', () => {
  function configure(): void {
    process.env.STORAGE_DRIVER = 'supabase';
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.SUPABASE_STORAGE_BUCKET = 'private-files';
  }

  it('uploads, reads, and deletes through authenticated private object endpoints', async () => {
    configure();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('private bytes', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const storage = new PrivateStorageService();

    const key = await storage.upload(Buffer.from('private bytes'), 'application/pdf');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://project.supabase.co/storage/v1/object/private-files/${key}`,
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer service-role-secret',
        apikey: 'service-role-secret',
        'Content-Type': 'application/pdf',
        'x-upsert': 'false',
      }),
    });
    const stored = await storage.read(key);
    expect(stored.size).toBe(13);
    expect((await streamContents(stored.stream)).toString()).toBe('private bytes');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `https://project.supabase.co/storage/v1/object/authenticated/private-files/${key}`,
    );
    await storage.delete(key);
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('reports provider failures without exposing the service role key', async () => {
    configure();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(`failure service-role-secret`, { status: 503 }),
      ),
    );

    await expect(
      new PrivateStorageService().upload(Buffer.from('x'), 'application/pdf'),
    ).rejects.toThrow('Supabase storage upload failed with status 503');
    await expect(
      new PrivateStorageService().upload(Buffer.from('x'), 'application/pdf'),
    ).rejects.not.toThrow('service-role-secret');
  });

  it('maps missing remote objects to a storage not-found error', async () => {
    configure();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));

    await expect(new PrivateStorageService().read('a'.repeat(64))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(new PrivateStorageService().delete('a'.repeat(64))).resolves.toBeUndefined();
  });

  it('boundedly verifies remote size when Content-Length is unavailable', async () => {
    configure();
    process.env.MAX_UPLOAD_BYTES = '4';
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('12345'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));

    await expect(new PrivateStorageService().read('a'.repeat(64))).rejects.toThrow(
      'Stored object exceeds the configured maximum size',
    );
  });

  it('rejects incomplete or invalid configuration before making a request', async () => {
    configure();
    process.env.SUPABASE_URL = 'http://project.supabase.co';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new PrivateStorageService().upload(Buffer.from('x'), 'application/pdf'),
    ).rejects.toThrow('SUPABASE_URL must be a valid HTTPS URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
