import { describe, expect, it } from 'vitest';

import { apiUrl, normalizeApiOrigin } from '../apiOrigin';

describe('normalizeApiOrigin', () => {
  it.each([undefined, '', '   '])('preserves relative API URLs for blank value %j', (value) => {
    expect(normalizeApiOrigin(value)).toBe('');
  });

  it('accepts an exact HTTPS origin and removes a trailing slash', () => {
    expect(normalizeApiOrigin('https://api.example.com/')).toBe('https://api.example.com');
  });

  it.each([
    'http://api.example.com',
    'https://api.example.com/base',
    'https://api.example.com?region=id',
    'https://user:password@api.example.com',
  ])('rejects a value that is not an exact HTTPS origin: %s', (value) => {
    expect(() => normalizeApiOrigin(value)).toThrow('VITE_API_ORIGIN must be an exact HTTPS origin');
  });
});

describe('apiUrl', () => {
  it('leaves API paths relative when the origin is blank', () => {
    expect(apiUrl('/api/auth/me', '')).toBe('/api/auth/me');
  });

  it('prefixes API paths with the configured origin', () => {
    expect(apiUrl('/api/auth/me', 'https://api.example.com')).toBe('https://api.example.com/api/auth/me');
  });

  it('leaves non-API URLs unchanged', () => {
    expect(apiUrl('https://files.example.com/document.pdf', 'https://api.example.com')).toBe(
      'https://files.example.com/document.pdf',
    );
  });
});
