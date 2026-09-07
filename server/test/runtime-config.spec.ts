import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RuntimeConfigValidator } from '../src/runtime-config';

const ORIGINAL_ENV = { ...process.env };
const VALID_PRODUCTION_ENV = {
  NODE_ENV: 'production',
  TRUST_PROXY_HOPS: '1',
  COOKIE_SECURE: 'true',
  CORS_ORIGINS: 'https://jrc.example.test,https://admin.jrc.example.test:8443',
  TICKET_SECRET: 'a-production-ticket-secret-with-32-characters',
  STORAGE_PATH: '/srv/jrc/private',
  PUBLIC_VERIFICATION_URL: 'https://jrc.example.test/ticket/verify',
  DATABASE_URL: 'postgresql://jrc@example.test:5432/jrc',
};

describe('RuntimeConfigValidator', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ...VALID_PRODUCTION_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('does not enforce production settings outside production', () => {
    process.env = { NODE_ENV: 'test' };

    expect(() => new RuntimeConfigValidator().onModuleInit()).not.toThrow();
  });

  it('accepts a complete safe production configuration', () => {
    expect(() => new RuntimeConfigValidator().onModuleInit()).not.toThrow();
  });

  it('lists every missing required variable without exposing values', () => {
    process.env = {
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: 'invalid-secret-value',
      COOKIE_SECURE: 'false',
      CORS_ORIGINS: '',
      TICKET_SECRET: 'replace-me-secret-value',
      STORAGE_PATH: '   ',
      PUBLIC_VERIFICATION_URL: 'not-a-secret-value',
      DATABASE_URL: '',
    };

    let message = '';
    try {
      new RuntimeConfigValidator().onModuleInit();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/TRUST_PROXY_HOPS/);
    expect(message).toMatch(/COOKIE_SECURE/);
    expect(message).toMatch(/CORS_ORIGINS/);
    expect(message).toMatch(/TICKET_SECRET/);
    expect(message).toMatch(/STORAGE_PATH/);
    expect(message).toMatch(/PUBLIC_VERIFICATION_URL/);
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain('replace-me-secret-value');
    expect(message).not.toContain('not-a-secret-value');
    expect(message).not.toContain('invalid-secret-value');
  });

  it.each([undefined, '', '0', '4', '-1', '1.5', '1e0', 'not-an-integer'])(
    'rejects invalid production TRUST_PROXY_HOPS value %j',
    (value) => {
      if (value === undefined) {
        delete process.env.TRUST_PROXY_HOPS;
      } else {
        process.env.TRUST_PROXY_HOPS = value;
      }

      expect(() => new RuntimeConfigValidator().onModuleInit()).toThrowError(
        /TRUST_PROXY_HOPS/,
      );
    },
  );

  it.each(['1', '2', '3'])(
    'accepts production TRUST_PROXY_HOPS value %j',
    (value) => {
      process.env.TRUST_PROXY_HOPS = value;

      expect(() => new RuntimeConfigValidator().onModuleInit()).not.toThrow();
    },
  );

  it.each(['', '0', 'false', 'no', 'off'])(
    'rejects non-truthy COOKIE_SECURE value %j',
    (value) => {
      process.env.COOKIE_SECURE = value;

      expect(() => new RuntimeConfigValidator().onModuleInit()).toThrowError(
        /COOKIE_SECURE/,
      );
    },
  );

  it.each([
    '',
    'http://jrc.example.test',
    'https://user:password@jrc.example.test',
    'https://jrc.example.test/',
    'https://jrc.example.test/path',
    'https://jrc.example.test?query=yes',
    'https://jrc.example.test#fragment',
    'https://jrc.example.test,',
    'not-an-origin',
  ])('rejects unsafe CORS_ORIGINS value %j', (value) => {
    process.env.CORS_ORIGINS = value;

    expect(() => new RuntimeConfigValidator().onModuleInit()).toThrowError(
      /CORS_ORIGINS/,
    );
  });

  it.each([
    'short',
    'replace-me-with-a-real-production-ticket-secret',
  ])('rejects unsafe TICKET_SECRET value', (value) => {
    process.env.TICKET_SECRET = value;

    expect(() => new RuntimeConfigValidator().onModuleInit()).toThrowError(
      /TICKET_SECRET/,
    );
  });

  it.each([
    'not-a-url',
    'http://jrc.example.test/ticket/verify',
    'https://user:password@jrc.example.test/ticket/verify',
  ])('rejects unsafe PUBLIC_VERIFICATION_URL value', (value) => {
    process.env.PUBLIC_VERIFICATION_URL = value;

    expect(() => new RuntimeConfigValidator().onModuleInit()).toThrowError(
      /PUBLIC_VERIFICATION_URL/,
    );
  });
});