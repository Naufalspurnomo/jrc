import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

function getTrustProxyHops(): number {
  const configuredValue = process.env.TRUST_PROXY_HOPS;
  const value =
    configuredValue === undefined && process.env.NODE_ENV !== 'production'
      ? '0'
      : configuredValue;

  if (value === undefined || !/^[0-3]$/.test(value)) {
    throw new Error('Invalid TRUST_PROXY_HOPS');
  }

  return Number(value);
}

export function configureApp(app: INestApplication): void {
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', getTrustProxyHops());
  app.use(cookieParser());
  app.use(helmet({ frameguard: { action: 'deny' } }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  app.enableCors({
    credentials: true,
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'), false);
    },
  });
}

export async function bootstrap(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  app.useLogger(app.get(Logger));
  app.flushLogs();
  app.enableShutdownHooks();

  const requestedPort = Number.parseInt(process.env.PORT ?? '3000', 10);
  const port = Number.isInteger(requestedPort) && requestedPort > 0
    ? requestedPort
    : 3000;
  await app.listen(port, process.env.HOST ?? '0.0.0.0');
  return app;
}