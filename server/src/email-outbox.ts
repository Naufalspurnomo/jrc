import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { type EmailOutbox, OutboxStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from './prisma.service';

const BATCH_SIZE = 25;
const LOCK_DURATION_MS = 60_000;
const RETRY_BASE_DELAY_MS = 60_000;
const RETRY_MAX_DELAY_MS = 60 * 60_000;
const MAX_ERROR_LENGTH = 1_000;
const DEFAULT_PROCESS_INTERVAL_MS = 5_000;

type EmailTransport = 'noop' | 'console' | 'smtp';

@Injectable()
export class EmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxService.name);
  private smtpTransport?: Transporter;
  private interval?: NodeJS.Timeout;
  private scheduledRunActive = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.validateRuntimeConfiguration();
    this.interval = setInterval(() => {
      void this.runScheduled();
    }, this.processIntervalMs());
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.smtpTransport?.close();
    this.smtpTransport = undefined;
  }

  async processOnce(): Promise<number> {
    const now = new Date();
    const rows = await this.prisma.emailOutbox.findMany({
      where: {
        OR: [
          {
            status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
            availableAt: { lte: now },
          },
          {
            status: OutboxStatus.PROCESSING,
            lockedUntil: { lte: now },
          },
        ],
      },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
      take: BATCH_SIZE,
    });

    let sent = 0;
    for (const row of rows) {
      if (row.attempts >= row.maxAttempts) {
        continue;
      }

      const workerToken = randomUUID();
      const claim = await this.prisma.emailOutbox.updateMany({
        where: this.claimGuard(row, now),
        data: {
          status: OutboxStatus.PROCESSING,
          lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
          workerToken,
        },
      });

      if (claim.count !== 1) {
        continue;
      }

      try {
        await this.deliver(row);
        const markedSent = await this.prisma.emailOutbox.updateMany({
          where: {
            id: row.id,
            status: OutboxStatus.PROCESSING,
            workerToken,
          },
          data: {
            status: OutboxStatus.SENT,
            sentAt: now,
            lastError: null,
            lockedUntil: null,
            workerToken: null,
          },
        });
        if (markedSent.count === 1) {
          sent += 1;
        }
      } catch (error: unknown) {
        await this.markFailed(row, workerToken, now, error);
      }
    }

    return sent;
  }

  private claimGuard(row: EmailOutbox, now: Date) {
    if (row.status === OutboxStatus.PROCESSING) {
      return {
        id: row.id,
        status: OutboxStatus.PROCESSING,
        attempts: row.attempts,
        lockedUntil: { lte: now },
        workerToken: row.workerToken,
      };
    }

    return {
      id: row.id,
      status: row.status,
      attempts: row.attempts,
      availableAt: { lte: now },
    };
  }

  private async deliver(row: EmailOutbox): Promise<void> {
    const transport = this.emailTransport();
    if (transport === 'noop') {
      return;
    }

    if (transport === 'console') {
      this.logger.log(
        `Console email outboxId=${row.id} recipientDomain=${this.recipientDomain(row.to)}`,
      );
      return;
    }

    const smtp = this.smtpTransport ?? this.createSmtpTransport();
    this.smtpTransport = smtp;
    await smtp.sendMail({
      from: process.env.SMTP_FROM,
      to: row.to,
      subject: row.subject,
      text: row.body,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  private createSmtpTransport(): Transporter {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: this.smtpPort(),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_APP_PASSWORD,
      },
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  private emailTransport(): EmailTransport {
    const value = process.env.EMAIL_TRANSPORT ?? 'noop';
    if (value === 'noop' || value === 'console' || value === 'smtp') {
      return value;
    }
    throw new Error('Unsupported EMAIL_TRANSPORT');
  }

  private processIntervalMs(): number {
    const value = Number(
      process.env.EMAIL_POLL_INTERVAL_MS ?? DEFAULT_PROCESS_INTERVAL_MS,
    );
    if (!Number.isSafeInteger(value) || value < 1_000 || value > 300_000) {
      throw new Error(
        'EMAIL_POLL_INTERVAL_MS must be an integer between 1000 and 300000',
      );
    }
    return value;
  }

  private validateRuntimeConfiguration(): void {
    const transport = this.emailTransport();
    if (process.env.NODE_ENV === 'production' && transport !== 'smtp') {
      throw new Error('EMAIL_TRANSPORT must be smtp in production');
    }
    if (transport !== 'smtp') return;

    for (const name of [
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_APP_PASSWORD',
      'SMTP_FROM',
    ] as const) {
      if (!process.env[name]?.trim()) {
        throw new Error(`${name} is required for SMTP`);
      }
    }
    this.smtpPort();
  }

  private smtpPort(): number {
    const port = Number(process.env.SMTP_PORT ?? '587');
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error('Invalid SMTP_PORT');
    }
    return port;
  }

  private recipientDomain(address: string): string {
    const separator = address.lastIndexOf('@');
    if (separator < 0 || separator === address.length - 1) {
      return 'invalid';
    }
    return address.slice(separator + 1).trim().toLowerCase();
  }

  private async markFailed(
    row: EmailOutbox,
    workerToken: string,
    now: Date,
    error: unknown,
  ): Promise<void> {
    const delay = Math.min(
      RETRY_BASE_DELAY_MS * 2 ** Math.min(row.attempts, 30),
      RETRY_MAX_DELAY_MS,
    );
    await this.prisma.emailOutbox.updateMany({
      where: {
        id: row.id,
        status: OutboxStatus.PROCESSING,
        workerToken,
      },
      data: {
        status: OutboxStatus.FAILED,
        attempts: { increment: 1 },
        availableAt: new Date(now.getTime() + delay),
        lastError: this.sanitizeError(error),
        lockedUntil: null,
        workerToken: null,
      },
    });
  }

  private sanitizeError(error: unknown): string {
    let message = 'Email delivery failed';
    if (error instanceof Error && error.message) {
      message = error.message;
    } else if (typeof error === 'string' && error) {
      message = error;
    }

    const password = process.env.SMTP_APP_PASSWORD;
    if (password) {
      message = message.split(password).join('[REDACTED]');
    }
    const withoutControlCharacters = Array.from(message, (character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127 ? ' ' : character;
    }).join('');
    return withoutControlCharacters
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_ERROR_LENGTH);
  }

  private async runScheduled(): Promise<void> {
    if (this.scheduledRunActive) {
      return;
    }
    this.scheduledRunActive = true;
    try {
      await this.processOnce();
    } catch {
      this.logger.error('Email outbox processing failed');
    } finally {
      this.scheduledRunActive = false;
    }
  }
}