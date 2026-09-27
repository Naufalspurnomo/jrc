import { InternalServerErrorException, PayloadTooLargeException } from '@nestjs/common';

/** Default per-file upload limit: 5 MiB (5,242,880 bytes). */
export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function maxUploadBytes(): number {
  const configured = process.env.MAX_UPLOAD_BYTES?.trim();
  if (!configured) return DEFAULT_MAX_UPLOAD_BYTES;
  const parsed = Number(configured);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new InternalServerErrorException('MAX_UPLOAD_BYTES must be a positive integer');
  }
  return parsed;
}

export function uploadLimitDescription(bytes = maxUploadBytes()): string {
  return bytes === DEFAULT_MAX_UPLOAD_BYTES ? '5 MiB (5,242,880 bytes)' : `${bytes} bytes`;
}

export function assertUploadSize(size: number, subject: string): void {
  const limit = maxUploadBytes();
  if (size > limit) {
    throw new PayloadTooLargeException(
      `${subject} exceeds the per-file limit of ${uploadLimitDescription(limit)}`,
    );
  }
}
