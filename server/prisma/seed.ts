/// <reference types="node" />

import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const STAFF_ROLES = [
  Role.SUPER_ADMIN,
  Role.REGISTRATION_REVIEWER,
  Role.FINANCE,
  Role.GATE_STAFF,
  Role.SUPPORT,
] as const;

const COMPETITION_DEFINITIONS = [
  {
    slug: 'donatopia-transporter',
    name: 'Donatopia — Transporter',
    level: 'SD',
    discipline: 'Transporter',
    feeEnv: 'TRANSPORTER_SD_FEE',
    defaultFee: 250_000,
  },
  {
    slug: 'nightmaze-rescue-transporter',
    name: 'Nightmaze — Rescue Transporter',
    level: 'SMP',
    discipline: 'Rescue Transporter',
    feeEnv: 'RESCUE_SMP_FEE',
    defaultFee: 300_000,
  },
  {
    slug: 'pirate-clash-transporter-shooter',
    name: 'Pirate Clash — Transporter Shooter',
    level: 'SMA',
    discipline: 'Transporter Shooter',
    feeEnv: 'SHOOTER_SMA_FEE',
    defaultFee: 350_000,
  },
  {
    slug: 'wacky-rally-line-follower-mikro',
    name: 'Wacky Rally — Line Follower Mikro',
    level: 'Umum',
    discipline: 'Line Follower Mikro',
    feeEnv: 'LINE_FOLLOWER_FEE',
    defaultFee: 300_000,
  },
  {
    slug: 'ring-rumble-sumo',
    name: 'Ring Rumble — Sumo',
    level: 'Umum',
    discipline: 'Sumo',
    feeEnv: 'SUMO_FEE',
    defaultFee: 300_000,
  },
  {
    slug: 'goal-rush-soccer',
    name: 'Goal Rush — Soccer',
    level: 'Umum',
    discipline: 'Soccer',
    feeEnv: 'SOCCER_FEE',
    defaultFee: 350_000,
  },
] as const;

type StaffSeed = {
  role: (typeof STAFF_ROLES)[number];
  email: string;
  password: string;
};

function nonEmptyEnv(name: string, fallback: string): string {
  const value = process.env[name] ?? fallback;
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${name} must not be empty`);
  return normalized;
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim() || String(fallback);
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > 2_147_483_647) {
    throw new Error(`${name} must be a positive 32-bit integer`);
  }
  return value;
}

function dateTimeEnv(name: string, fallback: string): Date {
  const raw = process.env[name] ?? fallback;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) {
    throw new Error(`${name} must be an ISO 8601 date-time with a timezone`);
  }
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) throw new Error(`${name} must be a valid date-time`);
  return value;
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function validateEmail(name: string, email: string): void {
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email)
  ) {
    throw new Error(`${name} must be a valid email address`);
  }
}

function validatePassword(name: string, password: string): void {
  if (
    password.length < 12 ||
    password.length > 1_024 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(`${name} must be 12-1024 characters and include uppercase, lowercase, number, and symbol`);
  }
}

function readStaffSeeds(): StaffSeed[] {
  const seeds: StaffSeed[] = [];
  const rolesByEmail = new Map<string, Role>();

  for (const role of STAFF_ROLES) {
    const prefix = `SEED_${role}`;
    const configuredEmail = process.env[`${prefix}_EMAIL`];
    const configuredPassword = process.env[`${prefix}_PASSWORD`];
    const rawEmail = configuredEmail?.trim() ? configuredEmail : undefined;
    const password = configuredPassword?.trim() ? configuredPassword : undefined;

    if ((rawEmail === undefined) !== (password === undefined)) {
      throw new Error(`${prefix}_EMAIL and ${prefix}_PASSWORD must be provided together`);
    }
    if (rawEmail === undefined || password === undefined) continue;

    const email = normalizeEmail(rawEmail);
    validateEmail(`${prefix}_EMAIL`, email);
    validatePassword(`${prefix}_PASSWORD`, password);

    const configuredRole = rolesByEmail.get(email);
    if (configuredRole !== undefined && configuredRole !== role) {
      throw new Error('A staff email cannot be configured for multiple roles');
    }
    rolesByEmail.set(email, role);
    seeds.push({ role, email, password });
  }

  return seeds;
}

function displayNameForRole(role: Role): string {
  return role
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

async function hashUnlessUnchanged(password: string, currentHash?: string): Promise<string> {
  if (currentHash?.startsWith('$argon2id$')) {
    try {
      if (await argon2.verify(currentHash, password)) return currentHash;
    } catch {
      // Replace an unreadable legacy hash with an Argon2id hash.
    }
  }
  return argon2.hash(password, { type: argon2.argon2id });
}

async function main(): Promise<void> {
  const eventId = nonEmptyEnv('EVENT_ID', 'JRC-XIV-2026');
  const eventName = nonEmptyEnv('EVENT_NAME', 'JRC XIV — Imperium Machina');
  const registrationDeadline = dateTimeEnv(
    'REGISTRATION_DEADLINE',
    '2026-12-31T23:59:59.000+07:00',
  );
  if (registrationDeadline.getTime() <= Date.now()) {
    throw new Error('REGISTRATION_DEADLINE must be later than the current time');
  }
  const currency = nonEmptyEnv('CURRENCY', 'IDR').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('CURRENCY must be a three-letter currency code');

  const competitions = COMPETITION_DEFINITIONS.map((competition) => ({
    ...competition,
    fee: positiveIntegerEnv(competition.feeEnv, competition.defaultFee),
  }));
  const staffSeeds = readStaffSeeds();

  await prisma.$transaction(async (tx) => {
    for (const competition of competitions) {
      await tx.competition.upsert({
        where: { slug: competition.slug },
        create: {
          slug: competition.slug,
          name: competition.name,
          level: competition.level,
          discipline: competition.discipline,
          eventId,
          eventName,
          fee: competition.fee,
          currency,
          registrationDeadline,
        },
        update: {
          name: competition.name,
          level: competition.level,
          discipline: competition.discipline,
          eventId,
          eventName,
          fee: competition.fee,
          currency,
          registrationDeadline,
        },
      });
    }

    for (const staff of staffSeeds) {
      const matches = await tx.user.findMany({
        where: { email: { equals: staff.email, mode: 'insensitive' } },
      });
      if (matches.length > 1) throw new Error(`Ambiguous existing staff email collision for ${staff.role}`);

      const existing = matches[0];
      if (existing !== undefined && existing.role !== staff.role) {
        throw new Error(`Existing account has a different role than ${staff.role}`);
      }
      if (existing !== undefined && existing.email !== staff.email) {
        await tx.user.update({ where: { id: existing.id }, data: { email: staff.email } });
      }

      const passwordHash = await hashUnlessUnchanged(staff.password, existing?.passwordHash);
      await tx.user.upsert({
        where: { email: staff.email },
        create: {
          email: staff.email,
          displayName: displayNameForRole(staff.role),
          passwordHash,
          role: staff.role,
        },
        update: { passwordHash },
      });
    }
  });
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown seed error';
    console.error(`Seed failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
