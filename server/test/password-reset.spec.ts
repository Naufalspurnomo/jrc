import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, hashToken } from '../src/auth';
import type { PrismaService } from '../src/prisma.service';

type TestUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const user: TestUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'owner@example.test',
  displayName: 'Owner',
  passwordHash: 'old-hash',
  role: Role.PARTICIPANT,
  active: true,
  emailVerifiedAt: new Date('2026-09-01T00:00:00.000Z'),
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-02T00:00:00.000Z'),
};

function setup(foundUser: TestUser | null = user) {
  const tx = {
    passwordResetToken: {
      create: vi.fn().mockResolvedValue({ id: 'reset-1' }),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    emailOutbox: { create: vi.fn().mockResolvedValue({ id: 'email-1' }) },
    user: {
      update: vi.fn().mockResolvedValue(user),
    },
    session: {
      create: vi.fn().mockResolvedValue({ id: 'session-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    $queryRaw: vi.fn().mockResolvedValue(foundUser ? [{ id: foundUser.id }] : []),
  };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(foundUser) },
    passwordResetToken: { findUnique: vi.fn() },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => Promise.resolve(callback(tx))),
  };
  return { service: new AuthService(prisma as unknown as PrismaService), prisma, tx };
}

beforeEach(() => {
  process.env.TICKET_SECRET = 'test-password-reset-encryption-key-with-32-bytes';
  delete process.env.PUBLIC_PASSWORD_RESET_URL;
});

describe('participant password reset', () => {
  it('does not create a session when the verified password changed before session creation', async () => {
    const passwordHash = await argon2.hash('old-password-123');
    const { service, tx } = setup({ ...user, passwordHash });
    tx.$queryRaw.mockResolvedValue([]);

    await expect(
      service.login({ email: user.email, password: 'old-password-123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.session.create).not.toHaveBeenCalled();
  });

  it('keeps unknown reset requests pending for a minimum response window', async () => {
    vi.useFakeTimers();
    try {
      const { service } = setup(null);
      let settled = false;
      const request = service.requestPasswordReset({ email: 'missing@example.test' })
        .finally(() => { settled = true; });

      await vi.advanceTimersByTimeAsync(249);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(request).resolves.toEqual({ success: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns the same generic response for known and unknown emails', async () => {
    const known = setup();
    const unknown = setup(null);

    await expect(known.service.requestPasswordReset({ email: ' OWNER@example.test ' })).resolves.toEqual({ success: true });
    await expect(unknown.service.requestPasswordReset({ email: 'missing@example.test' })).resolves.toEqual({ success: true });
    expect(unknown.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('stores only a hash of a high-entropy token and queues a reset email transactionally', async () => {
    const { service, tx } = setup();

    await service.requestPasswordReset({ email: user.email });

    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        createdAt: { lte: expect.any(Date) },
      },
      data: expect.objectContaining({
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
        consumedAt: null,
        createdAt: expect.any(Date),
      }),
    });
    expect(tx.emailOutbox.create).toHaveBeenCalledOnce();
    expect(tx.emailOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ expiresAt: expect.any(Date) }),
    });
    const body = tx.emailOutbox.create.mock.calls[0]?.[0]?.data?.body as string;
    expect(body).not.toContain(
      tx.passwordResetToken.updateMany.mock.calls[0]?.[0]?.data?.tokenHash,
    );
    expect(body).not.toContain(user.passwordHash);
  });

  it('silently suppresses reset email spam during the per-user cooldown', async () => {
    const { service, tx } = setup();
    tx.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    tx.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-1',
      userId: user.id,
      createdAt: new Date(),
    });

    await expect(
      service.requestPasswordReset({ email: user.email }),
    ).resolves.toEqual({ success: true });
    expect(tx.emailOutbox.create).not.toHaveBeenCalled();
  });

  it('ignores admin, inactive, and unverified accounts without creating tokens', async () => {
    for (const found of [
      { ...user, role: Role.SUPER_ADMIN },
      { ...user, active: false },
      { ...user, emailVerifiedAt: null },
    ]) {
      const { service, prisma } = setup(found);
      await expect(service.requestPasswordReset({ email: found.email })).resolves.toEqual({ success: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('atomically consumes a live token, applies Argon2id, and revokes all sessions', async () => {
    const rawToken = 'A'.repeat(43);
    const { service, prisma, tx } = setup();
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-1',
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user,
    });
    await expect(service.resetPassword({ token: rawToken, password: 'new-password-123' })).resolves.toEqual({ success: true });
    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'reset-1', tokenHash: hashToken(rawToken), consumedAt: null,
        expiresAt: { gt: expect.any(Date) },
        user: { active: true, role: Role.PARTICIPANT },
      },
      data: { consumedAt: expect.any(Date) },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { passwordHash: expect.stringMatching(/^\$argon2id\$/) },
    });
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it.each([
    ['malformed', 'short', null],
    ['unknown', 'B'.repeat(43), null],
    ['expired', 'C'.repeat(43), { expiresAt: new Date(Date.now() - 1), consumedAt: null }],
    ['consumed', 'D'.repeat(43), { expiresAt: new Date(Date.now() + 60_000), consumedAt: new Date() }],
  ])('rejects %s reset tokens without changing a password', async (_label, token, tokenState) => {
    const { service, prisma, tx } = setup();
    prisma.passwordResetToken.findUnique.mockResolvedValue(tokenState ? {
      id: 'reset-1', userId: user.id, tokenHash: hashToken(token), user, ...tokenState,
    } : null);

    await expect(service.resetPassword({ token, password: 'new-password-123' })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });

  it('rejects token reuse when the atomic claim loses the race', async () => {
    const token = 'E'.repeat(43);
    const { service, prisma, tx } = setup();
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-1', userId: user.id, tokenHash: hashToken(token), user,
      expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
    });
    tx.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.resetPassword({ token, password: 'new-password-123' })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
