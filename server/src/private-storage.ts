import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { assertUploadSize, maxUploadBytes, uploadLimitDescription } from './upload-limits';

const STORAGE_KEY_PATTERN = /^[0-9a-f]{64}$/;

type StorageDriver = 'local' | 'supabase';

interface SupabaseConfig {
  baseUrl: string;
  bucket: string;
  serviceRoleKey: string;
}

export interface StoredObjectRead {
  stream: Readable;
  size: number;
}

function storageError(code: string, message: string): NodeJS.ErrnoException {
  return Object.assign(new Error(message), { code });
}

@Injectable()
export class PrivateStorageService {
  async upload(contents: Buffer, mimeType: string): Promise<string> {
    assertUploadSize(contents.length, 'Private storage object');
    const driver = this.driver();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const storageKey = randomBytes(32).toString('hex');
      try {
        if (driver === 'local') await this.uploadLocal(storageKey, contents);
        else await this.uploadSupabase(storageKey, contents, mimeType);
        return storageKey;
      } catch (error: unknown) {
        if (!this.isConflict(error) || attempt === 2) throw error;
      }
    }
    throw new InternalServerErrorException('Could not allocate a storage key');
  }

  async read(storageKey: string): Promise<StoredObjectRead> {
    this.assertStorageKey(storageKey);
    if (this.driver() === 'supabase') return this.readSupabase(storageKey);

    try {
      const handle = await open(
        this.localPath(storageKey),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      const fileStat = await handle.stat();
      if (!fileStat.isFile()) {
        await handle.close();
        throw storageError('ENOENT', 'Stored object not found');
      }
      return { stream: handle.createReadStream(), size: fileStat.size };
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ELOOP') {
        throw storageError('ENOENT', 'Stored object not found');
      }
      throw error;
    }
  }

  async delete(storageKey: string): Promise<void> {
    this.assertStorageKey(storageKey);
    if (this.driver() === 'supabase') {
      await this.deleteSupabase(storageKey);
      return;
    }
    try {
      await unlink(this.localPath(storageKey));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private driver(): StorageDriver {
    const value = process.env.STORAGE_DRIVER?.trim().toLowerCase() || 'local';
    if (value !== 'local' && value !== 'supabase') {
      throw new InternalServerErrorException(
        'STORAGE_DRIVER must be local or supabase',
      );
    }
    return value;
  }

  private localRoot(): string {
    const configured = process.env.STORAGE_PATH?.trim();
    if (!configured) {
      throw new InternalServerErrorException('STORAGE_PATH is required');
    }
    return resolve(configured);
  }

  private localPath(storageKey: string): string {
    const root = this.localRoot();
    const path = resolve(root, storageKey);
    if (dirname(path) !== root) throw new Error('Invalid storage key');
    return path;
  }

  private async uploadLocal(storageKey: string, contents: Buffer): Promise<void> {
    const root = this.localRoot();
    await mkdir(root, { recursive: true, mode: 0o700 });
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new InternalServerErrorException(
        'STORAGE_PATH must be a real directory',
      );
    }
    await chmod(root, 0o700);
    await writeFile(this.localPath(storageKey), contents, {
      flag: 'wx',
      mode: 0o600,
    });
  }

  private supabaseConfig(): SupabaseConfig {
    const rawUrl = process.env.SUPABASE_URL?.trim();
    let url: URL;
    try {
      url = new URL(rawUrl ?? '');
    } catch {
      throw new InternalServerErrorException(
        'SUPABASE_URL must be a valid HTTPS URL',
      );
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new InternalServerErrorException(
        'SUPABASE_URL must be a valid HTTPS URL',
      );
    }
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      throw new InternalServerErrorException(
        'SUPABASE_SERVICE_ROLE_KEY is required for Supabase storage',
      );
    }
    const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
    if (!bucket) {
      throw new InternalServerErrorException(
        'SUPABASE_STORAGE_BUCKET is required for Supabase storage',
      );
    }
    return {
      baseUrl: url.toString().replace(/\/$/, ''),
      bucket,
      serviceRoleKey,
    };
  }

  private objectUrl(config: SupabaseConfig, storageKey: string): string {
    return `${config.baseUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodeURIComponent(storageKey)}`;
  }

  private authenticatedObjectUrl(
    config: SupabaseConfig,
    storageKey: string,
  ): string {
    return `${config.baseUrl}/storage/v1/object/authenticated/${encodeURIComponent(config.bucket)}/${encodeURIComponent(storageKey)}`;
  }

  private headers(config: SupabaseConfig): Record<string, string> {
    return {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
    };
  }

  private async uploadSupabase(
    storageKey: string,
    contents: Buffer,
    mimeType: string,
  ): Promise<void> {
    const config = this.supabaseConfig();
    const response = await fetch(this.objectUrl(config, storageKey), {
      method: 'POST',
      headers: {
        ...this.headers(config),
        'Content-Type': mimeType,
        'x-upsert': 'false',
      },
      body: new Uint8Array(contents),
    });
    if (response.status === 409) throw storageError('EEXIST', 'Storage key conflict');
    if (!response.ok) {
      throw new InternalServerErrorException(
        `Supabase storage upload failed with status ${response.status}`,
      );
    }
  }

  private async readSupabase(storageKey: string): Promise<StoredObjectRead> {
    const config = this.supabaseConfig();
    const response = await fetch(this.authenticatedObjectUrl(config, storageKey), {
      method: 'GET',
      headers: this.headers(config),
    });
    if (response.status === 404) throw storageError('ENOENT', 'Stored object not found');
    if (!response.ok) {
      throw new InternalServerErrorException(
        `Supabase storage read failed with status ${response.status}`,
      );
    }
    if (!response.body) {
      throw new InternalServerErrorException(
        'Supabase storage read returned an empty response body',
      );
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength !== null && /^(0|[1-9]\d*)$/.test(contentLength)) {
      const size = Number(contentLength);
      if (Number.isSafeInteger(size)) {
        return { stream: Readable.fromWeb(response.body as never), size };
      }
    }

    const limit = maxUploadBytes();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new InternalServerErrorException(
            `Stored object exceeds the per-file limit of ${uploadLimitDescription(limit)}`,
          );
        }
        chunks.push(value);
      }
    } catch (error: unknown) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }
    return { stream: Readable.from(chunks), size };
  }


  private async deleteSupabase(storageKey: string): Promise<void> {
    const config = this.supabaseConfig();
    const response = await fetch(this.objectUrl(config, storageKey), {
      method: 'DELETE',
      headers: this.headers(config),
    });
    if (response.status === 404) return;
    if (!response.ok) {
      throw new InternalServerErrorException(
        `Supabase storage delete failed with status ${response.status}`,
      );
    }
  }

  private assertStorageKey(storageKey: string): void {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) throw new Error('Invalid storage key');
  }

  private isConflict(error: unknown): boolean {
    return (error as NodeJS.ErrnoException).code === 'EEXIST';
  }
}
