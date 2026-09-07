import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export function newOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function constantTimeHashEquals(token: string, expectedHash: string): boolean {
  if (!SHA256_HEX_PATTERN.test(expectedHash)) {
    return false;
  }

  const actual = createHash('sha256').update(token).digest();
  const expected = Buffer.from(expectedHash, 'hex');
  return timingSafeEqual(actual, expected);
}

export function createSessionSecrets() {
  const sessionToken = newOpaqueToken();
  const csrfToken = newOpaqueToken();

  return {
    sessionToken,
    sessionTokenHash: hashOpaqueToken(sessionToken),
    csrfToken,
    csrfTokenHash: hashOpaqueToken(csrfToken),
  };
}