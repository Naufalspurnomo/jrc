import { Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  constantTimeHashEquals,
  createSessionSecrets,
  hashOpaqueToken,
  newOpaqueToken,
} from '../src/auth/session-token';
import { serializeUser } from '../src/auth/user.serializer';
import { roleAllows } from '../src/auth/roles.guard';
import { serializeCompetition } from '../src/competitions/competition.serializer';

describe('opaque session credentials', () => {
  it('generates at least 256 bits and stores only deterministic SHA-256 hashes', () => {
    const token = newOpaqueToken();
    const otherToken = newOpaqueToken();

    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(hashOpaqueToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
    expect(hashOpaqueToken(otherToken)).not.toBe(hashOpaqueToken(token));
  });

  it('creates independent session and CSRF credentials', () => {
    const secrets = createSessionSecrets();

    expect(secrets.sessionToken).not.toBe(secrets.csrfToken);
    expect(secrets.sessionTokenHash).toBe(hashOpaqueToken(secrets.sessionToken));
    expect(secrets.csrfTokenHash).toBe(hashOpaqueToken(secrets.csrfToken));
    expect(constantTimeHashEquals(secrets.csrfToken, secrets.csrfTokenHash)).toBe(true);
    expect(constantTimeHashEquals(newOpaqueToken(), secrets.csrfTokenHash)).toBe(false);
    expect(constantTimeHashEquals(secrets.csrfToken, 'invalid')).toBe(false);
  });
});

describe('response sanitization', () => {
  it('never serializes password hashes or account control fields', () => {
    const user = serializeUser({
      id: 'user-id',
      email: 'user@example.test',
      displayName: 'User',
      passwordHash: 'secret-hash',
      role: Role.PARTICIPANT,
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(user).toEqual({
      id: 'user-id',
      email: 'user@example.test',
      displayName: 'User',
      role: Role.PARTICIPANT,
    });
    expect(JSON.stringify(user)).not.toMatch(/passwordHash|active|updatedAt/);
  });
});

describe('role matching', () => {
  it('allows exact roles and gives SUPER_ADMIN all role-constrained access', () => {
    expect(roleAllows(Role.FINANCE, [Role.FINANCE])).toBe(true);
    expect(roleAllows(Role.SUPER_ADMIN, [Role.FINANCE])).toBe(true);
    expect(roleAllows(Role.PARTICIPANT, [Role.FINANCE])).toBe(false);
    expect(roleAllows(Role.PARTICIPANT, [])).toBe(true);
  });
});

describe('competition serialization', () => {
  it('returns only the public competition contract', () => {
    const competition = serializeCompetition({
      id: 'competition-id',
      slug: 'line-follower',
      name: 'Line Follower',
      description: null,
      eventId: 'JRC-XIV-2026',
      eventName: 'JRC XIV 2026',
      fee: 250000,
      currency: 'IDR',
      active: true,
      registrationDeadline: new Date('2026-12-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(competition).toEqual({
      id: 'competition-id',
      slug: 'line-follower',
      name: 'Line Follower',
      description: null,
      eventId: 'JRC-XIV-2026',
      eventName: 'JRC XIV 2026',
      fee: 250000,
      currency: 'IDR',
      registrationDeadline: '2026-12-01T00:00:00.000Z',
    });
    expect(JSON.stringify(competition)).not.toMatch(/active|createdAt|updatedAt/);
  });
});
