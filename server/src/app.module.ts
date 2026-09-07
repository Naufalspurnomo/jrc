import {
  Controller,
  Get,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { LoggerModule } from 'nestjs-pino';
import {
  AdminRegistrationsController,
  AdminRegistrationsService,
  InvoiceController,
} from './admin-registrations';
import {
  AuthController,
  AuthGuard,
  AuthService,
  CsrfGuard,
  Public,
  RolesGuard,
} from './auth';
import {
  AdminDocumentsController,
  DocumentsService,
  DocumentUploadInterceptor,
  ParticipantDocumentsController,
} from './documents';
import { EmailOutboxService } from './email-outbox';
import { FinanceController, FinanceService } from './finance';
import { ManualPaymentProvider } from './payments/manual-payment.provider';
import {
  FinanceVerificationController,
  ParticipantTicketController,
  PaymentProofController,
  PaymentProofUploadInterceptor,
  PaymentVerificationService,
} from './payment-verification';
import { PrismaService } from './prisma.service';
import {
  RegistrationsController,
  RegistrationsService,
} from './registrations';
import { RuntimeConfigValidator } from './runtime-config';
import {
  GateController,
  TicketGateService,
  TicketVerificationController,
} from './ticket-gate';

interface RequestWithId extends Request {
  id: string;
  requestId?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PINO_LOG_LEVELS = new Set([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
]);
const configuredLogLevel = process.env.LOG_LEVEL ?? 'info';
const pinoLogLevel = PINO_LOG_LEVELS.has(configuredLogLevel)
  ? configuredLogLevel
  : 'info';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const supplied = request.headers['x-request-id'];
    const candidate = Array.isArray(supplied) ? supplied[0] : supplied;
    const requestId =
      typeof request.id === 'string' && UUID_PATTERN.test(request.id)
        ? request.id
        : typeof candidate === 'string' && UUID_PATTERN.test(candidate)
        ? candidate
        : randomUUID();
    request.id = requestId;
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}

@Public()
@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.competition.findMany({
      where: { active: true },
      orderBy: [{ registrationDeadline: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        eventId: true,
        eventName: true,
        fee: true,
        currency: true,
        active: true,
        registrationDeadline: true,
      },
    });
  }
}

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database is not ready');
    }
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: pinoLogLevel,
        genReqId: (request, response) => {
          const supplied = request.headers['x-request-id'];
          const candidate = Array.isArray(supplied) ? supplied[0] : supplied;
          const requestId =
            typeof candidate === 'string' && UUID_PATTERN.test(candidate)
              ? candidate
              : randomUUID();
          response.setHeader('x-request-id', requestId);
          return requestId;
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers.referer',
            "req.headers['x-csrf-token']",
            'req.body.password',
            'req.body.token',
            'req.body.csrfToken',
            "res.headers['set-cookie']",
          ],
          censor: '[REDACTED]',
        },
        autoLogging: {
          ignore: (request) =>
            /^\/(?:api\/)?health(?:\/|[?#]|$)/.test(request.url ?? ''),
        },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [
    AdminDocumentsController,
    AdminRegistrationsController,
    AuthController,
    CompetitionsController,
    GateController,
    HealthController,
    FinanceController,
    FinanceVerificationController,
    InvoiceController,
    ParticipantTicketController,
    PaymentProofController,
    ParticipantDocumentsController,
    RegistrationsController,
    TicketVerificationController,
  ],
  providers: [
    RuntimeConfigValidator,
    PrismaService,
    AuthService,
    AdminRegistrationsService,
    DocumentsService,
    DocumentUploadInterceptor,
    EmailOutboxService,
    FinanceService,
    {
      provide: ManualPaymentProvider,
      useFactory: () => new ManualPaymentProvider(),
    },
    PaymentProofUploadInterceptor,
    PaymentVerificationService,
    RegistrationsService,
    TicketGateService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [PrismaService, AuthService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}