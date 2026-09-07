import { Injectable, OnModuleInit } from '@nestjs/common';

const TRUTHY_VALUES = new Set(['1', 'true', 'yes']);

function isSafeHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

function hasSafeCorsOrigins(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const origins = value.split(',').map((origin) => origin.trim());
  return origins.length > 0 && origins.every(isSafeHttpsOrigin);
}

function hasSafeVerificationUrl(value: string | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function hasSafeProductionProxyHops(value: string | undefined): boolean {
  return value !== undefined && /^[1-3]$/.test(value);
}

@Injectable()
export class RuntimeConfigValidator implements OnModuleInit {
  onModuleInit(): void {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    const invalidVariables: string[] = [];
    if (!hasSafeProductionProxyHops(process.env.TRUST_PROXY_HOPS)) {
      invalidVariables.push('TRUST_PROXY_HOPS');
    }
    const cookieSecure = (process.env.COOKIE_SECURE ?? '').trim().toLowerCase();
    if (!TRUTHY_VALUES.has(cookieSecure)) {
      invalidVariables.push('COOKIE_SECURE');
    }
    if (!hasSafeCorsOrigins(process.env.CORS_ORIGINS)) {
      invalidVariables.push('CORS_ORIGINS');
    }

    const ticketSecret = process.env.TICKET_SECRET ?? '';
    if (
      ticketSecret.length < 32 ||
      ticketSecret.toLowerCase().includes('replace-me')
    ) {
      invalidVariables.push('TICKET_SECRET');
    }
    if (!process.env.STORAGE_PATH?.trim()) {
      invalidVariables.push('STORAGE_PATH');
    }
    if (!hasSafeVerificationUrl(process.env.PUBLIC_VERIFICATION_URL)) {
      invalidVariables.push('PUBLIC_VERIFICATION_URL');
    }
    if (!process.env.DATABASE_URL?.trim()) {
      invalidVariables.push('DATABASE_URL');
    }

    if (invalidVariables.length > 0) {
      throw new Error(
        `Invalid production runtime configuration: ${invalidVariables.join(', ')}`,
      );
    }
  }
}