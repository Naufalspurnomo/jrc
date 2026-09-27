import { InternalServerErrorException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertUploadSize,
  DEFAULT_MAX_UPLOAD_BYTES,
  maxUploadBytes,
} from '../src/upload-limits';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('upload limits', () => {
  it('defaults every per-file upload to exactly 5 MiB', () => {
    delete process.env.MAX_UPLOAD_BYTES;
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(5_242_880);
    expect(maxUploadBytes()).toBe(5_242_880);
  });

  it('accepts exactly 5 MiB and rejects 5 MiB plus one byte', () => {
    delete process.env.MAX_UPLOAD_BYTES;
    expect(() => assertUploadSize(5_242_880, 'Document')).not.toThrow();
    expect(() => assertUploadSize(5_242_881, 'Document')).toThrow(
      'Document exceeds the per-file limit of 5 MiB (5,242,880 bytes)',
    );
  });

  it('preserves a positive integer MAX_UPLOAD_BYTES override', () => {
    process.env.MAX_UPLOAD_BYTES = '1234';
    expect(maxUploadBytes()).toBe(1234);
  });

  it.each(['0', '-1', '1.5', 'not-a-number'])('rejects invalid override %s', (value) => {
    process.env.MAX_UPLOAD_BYTES = value;
    expect(() => maxUploadBytes()).toThrow(InternalServerErrorException);
  });
});
