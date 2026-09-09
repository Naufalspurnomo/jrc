import {
  BadRequestException,
  Body,
  CanActivate,
  ConflictException,
  Controller,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Injectable,
  Post,
  Req,
  Res,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Throttle } from '@nestjs/throttler';
import { Prisma, Role, Session, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { CookieOptions, Request, Response } from 'express';
import { PrismaService } from './prisma.service';
import { encryptEmailBody } from './email-outbox';

export const SESSION_COOKIE_NAME = 'jrc_session';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const IS_PUBLIC_KEY = 'jrc:is-public';
export const ROLES_KEY = 'jrc:roles';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthPrincipal {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  emailVerified: boolean;
}

export interface AuthenticatedRequest extends Request {
  principal: AuthPrincipal;
  currentSession: Session;
  requestId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().principal,
);

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Session =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().currentSession,
);

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeEmailValue = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? normalizeEmail(value) : value;

export class RegisterDto {
  @Transform(normalizeEmailValue)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @Transform(normalizeEmailValue)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}

interface IssuedAuth {
  user: AuthPrincipal;
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
}

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;
const RESEND_COOLDOWN_MS = 60 * 1_000;

function verificationBaseUrl(): string {
  const configured = process.env.PUBLIC_EMAIL_VERIFICATION_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('PUBLIC_EMAIL_VERIFICATION_URL must use http or https');
    }
    if (url.username || url.password) {
      throw new Error('PUBLIC_EMAIL_VERIFICATION_URL must not contain credentials');
    }
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PUBLIC_EMAIL_VERIFICATION_URL is required in production');
  }
  return 'http://localhost:5173/portal/verifikasi-email';
}

function buildVerificationLink(token: string): string {
  const base = verificationBaseUrl();
  const url = new URL(base);
  url.searchParams.set('token', token);
  return url.toString();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function sanitizeUser(user: User): AuthPrincipal {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
  };
}

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$FPKlUPw6z416PHjZaTmH0g$Eavx/5nADtf1L/TOd9LwSHNuWx0BFK04i3fXf/IlN7M';

function sessionCookieName(): string {
  const name = process.env.COOKIE_NAME?.trim() || SESSION_COOKIE_NAME;
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/.test(name)) {
    throw new BadRequestException('COOKIE_NAME is invalid');
  }
  return name;
}

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function sessionTtlMs(): number {
  const seconds = process.env.SESSION_TTL_SECONDS;
  if (seconds !== undefined) {
    const parsedSeconds = Number(seconds);
    if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
      throw new BadRequestException('SESSION_TTL_SECONDS must be positive');
    }
    return Math.floor(parsedSeconds * 1_000);
  }

  const parsedDays = Number(process.env.SESSION_TTL_DAYS ?? '7');
  if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
    throw new BadRequestException('SESSION_TTL_DAYS must be positive');
  }
  return Math.floor(parsedDays * 24 * 60 * 60 * 1_000);
}

function secureCookies(): boolean {
  return ['1', 'true', 'yes'].includes(
    (process.env.COOKIE_SECURE ?? '').trim().toLowerCase(),
  );
}

function sessionCookieOptions(maxAge?: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

function extractSessionToken(request: Request): string | undefined {
  const cookieName = sessionCookieName();
  const parsedCookie = request.cookies?.[cookieName] as unknown;
  if (typeof parsedCookie === 'string' && parsedCookie.length > 0) {
    return parsedCookie;
  }

  const header = request.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== cookieName) continue;
    try {
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      return value || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async probeSession(
    request: Request,
  ): Promise<{ user: AuthPrincipal | null }> {
    const token = extractSessionToken(request);
    if (!token) return { user: null };

    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { active: true },
      },
      include: { user: true },
    });
    return { user: session ? sanitizeUser(session.user) : null };
  }

  async register(dto: RegisterDto): Promise<IssuedAuth> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const material = this.createSessionMaterial();

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.user.create({
          data: {
            email,
            displayName: dto.displayName.trim(),
            passwordHash,
            role: Role.PARTICIPANT,
          },
        });
        await transaction.session.create({
          data: {
            userId: created.id,
            tokenHash: hashToken(material.sessionToken),
            csrfHash: hashToken(material.csrfToken),
            expiresAt: material.expiresAt,
          },
        });
        await this.sendVerificationEmail(transaction, created);
        return created;
      });

      return { user: sanitizeUser(user), ...material };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<IssuedAuth> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(dto.email) },
    });

    let validPassword: boolean;
    try {
      validPassword = await argon2.verify(
        user?.passwordHash ?? DUMMY_PASSWORD_HASH,
        dto.password,
      );
    } catch {
      validPassword = false;
    }

    if (!user?.active || !validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const material = this.createSessionMaterial();
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(material.sessionToken),
        csrfHash: hashToken(material.csrfToken),
        expiresAt: material.expiresAt,
      },
    });

    return { user: sanitizeUser(user), ...material };
  }

  async rotateCsrf(session: Session): Promise<string> {
    const csrfToken = randomToken();
    const result = await this.prisma.session.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { csrfHash: hashToken(csrfToken) },
    });
    if (result.count !== 1) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    return csrfToken;
  }

  async logout(session: Session): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private createSessionMaterial(): Omit<IssuedAuth, 'user'> {
    const ttl = sessionTtlMs();
    return {
      sessionToken: randomToken(),
      csrfToken: randomToken(),
      expiresAt: new Date(Date.now() + ttl),
    };
  }

  async issueVerificationToken(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<string> {
    const token = randomToken();
    await transaction.emailVerificationToken.deleteMany({ where: { userId } });
    await transaction.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      },
    });
    return token;
  }

  async sendVerificationEmail(
    transaction: Prisma.TransactionClient,
    user: { id: string; email: string; displayName: string },
  ): Promise<void> {
    const token = await this.issueVerificationToken(transaction, user.id);
    const link = buildVerificationLink(token);
    await transaction.emailOutbox.create({
      data: {
        to: user.email,
        subject: 'Verifikasi email akun JRC XIV',
        body: encryptEmailBody([
          `Halo ${user.displayName},`,
          '',
          'Konfirmasikan alamat email akun JRC XIV Anda dengan membuka tautan berikut:',
          link,
          '',
          'Tautan berlaku 24 jam. Jika Anda tidak merasa mendaftar, abaikan email ini.',
        ].join('\n')),
      },
    });
  }

  async requestResend(principal: AuthPrincipal): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: principal.id } });
    if (!user?.active) throw new UnauthorizedException('Authentication required');
    if (user.emailVerifiedAt) {
      throw new ConflictException('Email is already verified');
    }
    try {
      await this.prisma.$transaction(async (transaction) => {
        const token = randomToken();
        const now = new Date();
        const updated = await transaction.emailVerificationToken.updateMany({
          where: {
            userId: user.id,
            createdAt: { lte: new Date(now.getTime() - RESEND_COOLDOWN_MS) },
          },
          data: {
            tokenHash: hashToken(token),
            expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
            consumedAt: null,
            createdAt: now,
          },
        });
        if (updated.count === 0) {
          const existing = await transaction.emailVerificationToken.findUnique({
            where: { userId: user.id },
          });
          if (existing) {
            throw new HttpException(
              'A verification email was just sent. Try again later.',
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }
          await transaction.emailVerificationToken.create({
            data: {
              userId: user.id,
              tokenHash: hashToken(token),
              expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
            },
          });
        }
        await transaction.emailOutbox.create({
          data: {
            to: user.email,
            subject: 'Verifikasi email akun JRC XIV',
            body: encryptEmailBody([
              `Halo ${user.displayName},`,
              '',
              'Konfirmasikan alamat email akun JRC XIV Anda dengan membuka tautan berikut:',
              buildVerificationLink(token),
              '',
              'Tautan berlaku 24 jam. Jika Anda tidak merasa mendaftar, abaikan email ini.',
            ].join('\n')),
          },
        });
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new HttpException(
          'A verification email was just sent. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw error;
    }
    return { success: true };
  }

  async verifyByToken(
    dto: { token?: unknown },
  ): Promise<{ success: true }> {
    const token = typeof dto.token === 'string' ? dto.token.trim() : '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new BadRequestException('Verification token is invalid');
    }

    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (
      !record ||
      record.consumedAt ||
      record.expiresAt.getTime() <= Date.now() ||
      !record.user.active ||
      record.user.emailVerifiedAt
    ) {
      throw new BadRequestException('Verification link is invalid or expired');
    }

    await this.prisma.$transaction(async (transaction) => {
      const now = new Date();
      const claimed = await transaction.emailVerificationToken.updateMany({
        where: {
          id: record.id,
          tokenHash: hashToken(token),
          consumedAt: null,
          expiresAt: { gt: now },
          user: { active: true, emailVerifiedAt: null },
        },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('Verification link is invalid or expired');
      }
      await transaction.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: now },
      });
    });
    return { success: true };
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractSessionToken(request);
    if (!token) throw new UnauthorizedException('Authentication required');

    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { active: true },
      },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException('Authentication required');

    request.principal = sanitizeUser(session.user);
    request.currentSession = session;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) throw new UnauthorizedException('Authentication required');
    if (
      request.principal.role === Role.SUPER_ADMIN ||
      requiredRoles.includes(request.principal.role)
    ) {
      return true;
    }
    throw new ForbiddenException('Insufficient role');
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) {
      return true;
    }

    const supplied = request.headers[CSRF_HEADER_NAME];
    const csrfToken = Array.isArray(supplied) ? supplied[0] : supplied;
    if (typeof csrfToken !== 'string' || !request.currentSession) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    const expectedHash = Buffer.from(request.currentSession.csrfHash, 'hex');
    const suppliedHash = Buffer.from(hashToken(csrfToken), 'hex');
    if (
      expectedHash.length !== suppliedHash.length ||
      !timingSafeEqual(expectedHash, suppliedHash)
    ) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 60_000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: AuthPrincipal; csrfToken: string }> {
    const issued = await this.auth.register(dto);
    response.cookie(
      sessionCookieName(),
      issued.sessionToken,
      sessionCookieOptions(issued.expiresAt.getTime() - Date.now()),
    );
    return { user: issued.user, csrfToken: issued.csrfToken };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: AuthPrincipal; csrfToken: string }> {
    const issued = await this.auth.login(dto);
    response.cookie(
      sessionCookieName(),
      issued.sessionToken,
      sessionCookieOptions(issued.expiresAt.getTime() - Date.now()),
    );
    return { user: issued.user, csrfToken: issued.csrfToken };
  }

  @Public()
  @Get('me')
  async me(@Req() request: Request): Promise<{ user: AuthPrincipal | null }> {
    return this.auth.probeSession(request);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 60_000 } })
  @Post('email-verification/verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() body: { token?: string }): Promise<{ success: true }> {
    return this.auth.verifyByToken(body ?? {});
  }

  @Throttle({ default: { limit: 3, ttl: 60_000, blockDuration: 60_000 } })
  @Post('email-verification/resend')
  @HttpCode(HttpStatus.OK)
  resend(@CurrentUser() user: AuthPrincipal): Promise<{ success: true }> {
    return this.auth.requestResend(user);
  }

  @Get('csrf')
  async csrf(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ csrfToken: string }> {
    return { csrfToken: await this.auth.rotateCsrf(request.currentSession) };
  }

  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.auth.logout(request.currentSession);
    response.clearCookie(sessionCookieName(), sessionCookieOptions());
    return { success: true };
  }
}