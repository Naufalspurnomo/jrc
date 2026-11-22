import type { INestApplication } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../src/bootstrap';

describe('CORS configuration', () => {
  afterEach(() => {
    delete process.env.CORS_ORIGINS;
    delete process.env.TRUST_PROXY_HOPS;
  });

  it('denies an unlisted origin without raising an application error', () => {
    process.env.CORS_ORIGINS = 'https://jrc.example.test';
    process.env.TRUST_PROXY_HOPS = '1';
    const set = vi.fn();
    const app = {
      getHttpAdapter: () => ({ getInstance: () => ({ set }) }),
      use: vi.fn(),
      setGlobalPrefix: vi.fn(),
      useGlobalPipes: vi.fn(),
      enableCors: vi.fn(),
    } as unknown as INestApplication;

    configureApp(app);

    const options = vi.mocked(app.enableCors).mock.calls[0][0];
    const callback = vi.fn();
    expect(typeof options.origin).toBe('function');
    if (typeof options.origin !== 'function') throw new Error('Missing CORS origin callback');
    options.origin('https://evil.example', callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });
});