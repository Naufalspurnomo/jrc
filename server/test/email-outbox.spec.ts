import { Logger } from '@nestjs/common';
import { OutboxStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailOutboxService } from '../src/email-outbox';
import { PrismaService } from '../src/prisma.service';

const mailer = vi.hoisted(() => ({
  close: vi.fn(),
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: mailer.createTransport },
}));

const ORIGINAL_ENV = { ...process.env };
const NOW = new Date('2026-09-07T12:00:00.000Z');

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: '19825a38-95a3-48e2-b176-a00141378019',
    to: 'person@Sub.Example.test',
    subject: 'Registration update',
    body: 'Private email body',
    status: OutboxStatus.PENDING,
    attempts: 0,
    maxAttempts: 8,
    availableAt: new Date('2026-09-07T11:59:00.000Z'),
    lockedUntil: null,
    workerToken: null,
    lastError: null,
    sentAt: null,
    createdAt: new Date('2026-09-07T11:00:00.000Z'),
    updatedAt: new Date('2026-09-07T11:00:00.000Z'),
    ...overrides,
  };
}

function harness(rows = [record()]) {
  const emailOutbox = {
    findMany: vi.fn().mockResolvedValue(rows),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const prisma = { emailOutbox };
  return {
    emailOutbox,
    service: new EmailOutboxService(prisma as unknown as PrismaService),
  };
}

function configureSmtp(): void {
  process.env.EMAIL_TRANSPORT = 'smtp';
  process.env.SMTP_HOST = 'smtp.example.test';
  process.env.SMTP_PORT = '465';
  process.env.SMTP_SECURE = 'true';
  process.env.SMTP_USER = 'mailer@example.test';
  process.env.SMTP_APP_PASSWORD = 'not-a-real-password';
  process.env.SMTP_FROM = 'JRC <mailer@example.test>';
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'test',
    EMAIL_TRANSPORT: 'noop',
  };
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mailer.close.mockReset();
  mailer.createTransport.mockReset();
  mailer.sendMail.mockReset();
  mailer.createTransport.mockReturnValue({
    close: mailer.close,
    sendMail: mailer.sendMail,
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('EmailOutboxService processing', () => {
  it('atomically claims an eligible row and marks it sent with the same worker token', async () => {
    const { emailOutbox, service } = harness();

    await expect(service.processOnce()).resolves.toBe(1);

    expect(emailOutbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
              availableAt: { lte: NOW },
            },
            {
              status: OutboxStatus.PROCESSING,
              lockedUntil: { lte: NOW },
            },
          ],
        },
      }),
    );
    const claim = emailOutbox.updateMany.mock.calls[0]?.[0];
    expect(claim).toEqual({
      where: {
        id: record().id,
        status: OutboxStatus.PENDING,
        attempts: 0,
        availableAt: { lte: NOW },
      },
      data: {
        status: OutboxStatus.PROCESSING,
        lockedUntil: new Date('2026-09-07T12:01:00.000Z'),
        workerToken: expect.any(String),
      },
    });
    const workerToken = claim.data.workerToken as string;
    expect(emailOutbox.updateMany.mock.calls[1]?.[0]).toEqual({
      where: {
        id: record().id,
        status: OutboxStatus.PROCESSING,
        workerToken,
      },
      data: {
        status: OutboxStatus.SENT,
        sentAt: NOW,
        lastError: null,
        lockedUntil: null,
        workerToken: null,
      },
    });
  });

  it('reclaims expired processing locks with a guarded update', async () => {
    const expired = record({
      status: OutboxStatus.PROCESSING,
      lockedUntil: new Date('2026-09-07T11:58:00.000Z'),
      workerToken: 'expired-worker',
    });
    const { emailOutbox, service } = harness([expired]);

    await service.processOnce();

    expect(emailOutbox.updateMany.mock.calls[0]?.[0].where).toEqual({
      id: expired.id,
      status: OutboxStatus.PROCESSING,
      attempts: 0,
      lockedUntil: { lte: NOW },
      workerToken: 'expired-worker',
    });
  });

  it('does not send after losing the updateMany claim race', async () => {
    configureSmtp();
    mailer.sendMail.mockResolvedValue({});
    const { emailOutbox, service } = harness();
    emailOutbox.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.processOnce()).resolves.toBe(0);

    expect(mailer.sendMail).not.toHaveBeenCalled();
    expect(emailOutbox.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not claim rows that exhausted maxAttempts', async () => {
    const { emailOutbox, service } = harness([
      record({ attempts: 3, maxAttempts: 3, status: OutboxStatus.FAILED }),
    ]);

    await expect(service.processOnce()).resolves.toBe(0);

    expect(emailOutbox.updateMany).not.toHaveBeenCalled();
  });
});


describe('EmailOutboxService transports', () => {
  it('configures hardened SMTP and sends only plain text', async () => {
    configureSmtp();
    mailer.sendMail.mockResolvedValue({ messageId: 'test-id' });
    const { service } = harness();

    await service.processOnce();

    expect(mailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 465,
      secure: true,
      auth: {
        user: 'mailer@example.test',
        pass: 'not-a-real-password',
      },
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    expect(mailer.sendMail).toHaveBeenCalledWith({
      from: 'JRC <mailer@example.test>',
      to: record().to,
      subject: record().subject,
      text: record().body,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  });

  it('logs only the outbox ID and recipient domain for console transport', async () => {
    process.env.EMAIL_TRANSPORT = 'console';
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const { service } = harness();

    await service.processOnce();

    expect(log).toHaveBeenCalledWith(
      `Console email outboxId=${record().id} recipientDomain=sub.example.test`,
    );
    const output = JSON.stringify(log.mock.calls);
    expect(output).not.toContain('person@');
    expect(output).not.toContain(record().body);
    expect(output).not.toContain(record().subject);
  });
});
