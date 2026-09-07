import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasAllowedDocumentSignature,
  resolveDocumentStoragePath,
} from '../src/documents';

describe('document file validation', () => {
  it.each([
    ['application/pdf', Buffer.from('%PDF-')],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff])],
    ['image/png', Buffer.from('89504e470d0a1a0a', 'hex')],
  ])('accepts a minimal valid %s signature', (mimeType, contents) => {
    expect(hasAllowedDocumentSignature(mimeType, contents)).toBe(true);
  });

  it('requires the declared MIME type to match the magic bytes', () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    expect(hasAllowedDocumentSignature('application/pdf', png)).toBe(false);
    expect(hasAllowedDocumentSignature('image/jpeg', Buffer.from('%PDF-'))).toBe(
      false,
    );
    expect(hasAllowedDocumentSignature('text/plain', Buffer.from('%PDF-'))).toBe(
      false,
    );
  });
});

describe('document storage path containment', () => {
  const root = '/tmp/jrc-document-storage';
  const storageKey = 'a'.repeat(64);

  it('resolves an opaque storage key beneath the configured root', () => {
    expect(resolveDocumentStoragePath(root, storageKey)).toBe(
      resolve(root, storageKey),
    );
  });

  it.each(['../outside', '/tmp/outside', 'nested/file', '.', '', 'not-opaque'])(
    'rejects non-opaque or escaping storage key %s',
    (unsafeKey) => {
      expect(() => resolveDocumentStoragePath(root, unsafeKey)).toThrow(
        'Invalid document storage key',
      );
    },
  );
});
