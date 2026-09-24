import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const compose = readFileSync(resolve(root, 'docker-compose.yml'), 'utf8');
const dockerfile = readFileSync(resolve(root, 'server/Dockerfile'), 'utf8');
const readme = readFileSync(resolve(root, 'server/README.md'), 'utf8');
const cutover = readFileSync(resolve(root, 'PRODUCTION-CUTOVER.md'), 'utf8');
const releaseSha = 'a997e70e0c4af8caf71ad8f2e31932385d671826';
const immutableApi = 'registry.example/jrc-api@sha256:' + 'a'.repeat(64);
const immutableMigration = 'registry.example/jrc-migration@sha256:' + 'b'.repeat(64);

function service(name: string, next?: string): string {
  const end = next ? `(?=^  ${next}:)` : '(?=^volumes:)';
  const match = new RegExp(`^  ${name}:[\\s\\S]*?${end}`, 'm').exec(compose);
  if (!match) throw new Error(`Missing service ${name}`);
  return match[0];
}

function composeConfig(extraEnv: Record<string, string> = {}): string {
  return execFileSync('docker', ['compose', '-f', resolve(root, 'docker-compose.yml'), 'config'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      POSTGRES_DB: 'jrc',
      POSTGRES_USER: 'jrc',
      POSTGRES_PASSWORD: 'not-a-secret',
      COMPOSE_DATABASE_URL: 'postgresql://jrc:not-a-secret@jrc-db:5432/jrc',
      JRC_API_IMAGE: immutableApi,
      JRC_MIGRATION_IMAGE: immutableMigration,
      RELEASE_SHA: releaseSha,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function composeFailsWithout(name: 'JRC_API_IMAGE' | 'JRC_MIGRATION_IMAGE' | 'RELEASE_SHA'): void {
  const env = { ...process.env } as Record<string, string>;
  Object.assign(env, {
    POSTGRES_DB: 'jrc', POSTGRES_USER: 'jrc', POSTGRES_PASSWORD: 'not-a-secret',
    COMPOSE_DATABASE_URL: 'postgresql://jrc:not-a-secret@jrc-db:5432/jrc',
    JRC_API_IMAGE: immutableApi, JRC_MIGRATION_IMAGE: immutableMigration, RELEASE_SHA: releaseSha,
  });
  delete env[name];
  expect(() => execFileSync('docker', ['compose', '-f', resolve(root, 'docker-compose.yml'), 'config'], {
    cwd: root, env, stdio: 'pipe',
  })).toThrow();
}

describe('release artifact provenance contract', () => {
  it('pins PostgreSQL 17 by verified digest with a controlled override', () => {
    expect(service('jrc-db', 'jrc-api')).toMatch(/image:\s*"?\$\{JRC_DATABASE_IMAGE:-postgres@sha256:051f7b7b3abdd564d5d1bd1e8c4b9c1b6e77087d1dd22020ede611c096a272e0\}"?/);
    expect(compose).not.toContain('image: postgres:17-bookworm');
  });

  it('fails closed for application images and release SHA without service-level provenance spoofing', () => {
    const api = service('jrc-api', 'jrc-migrate');
    const migration = service('jrc-migrate');
    expect(api).toMatch(/image:\s*"?\$\{JRC_API_IMAGE:\?[^}]+\}"?/);
    expect(migration).toMatch(/image:\s*"?\$\{JRC_MIGRATION_IMAGE:\?[^}]+\}"?/);
    for (const [body, target] of [[api, 'production'], [migration, 'migration']] as const) {
      expect(body).toMatch(new RegExp(`target:\\s*${target}`));
      expect(body).toMatch(/RELEASE_SHA:\s*"?\$\{RELEASE_SHA:\?[^}]+\}"?/);
      expect(body).not.toMatch(/^\s+labels:/m);
      expect(body).not.toContain('org.opencontainers.image.revision');
      expect(body).not.toMatch(/(?:jrc-api|jrc-migration):local|RELEASE_SHA:-unknown/);
    }
  });

  it('renders with explicit immutable refs and SHA, then rejects every missing required value', () => {
    const resolved = composeConfig();
    expect(resolved).toContain(`image: ${immutableApi}`);
    expect(resolved).toContain(`image: ${immutableMigration}`);
    expect(resolved).toContain(`RELEASE_SHA: ${releaseSha}`);
    composeFailsWithout('JRC_API_IMAGE');
    composeFailsWithout('JRC_MIGRATION_IMAGE');
    composeFailsWithout('RELEASE_SHA');
  });

  it('labels both Docker targets with their build SHA', () => {
    expect(dockerfile.match(/^ARG RELEASE_SHA=unknown$/gm)).toHaveLength(2);
    expect(dockerfile.match(/^LABEL org\.opencontainers\.image\.revision="\$\{RELEASE_SHA\}"$/gm)).toHaveLength(2);
    expect(dockerfile).toMatch(/FROM node:22-bookworm-slim AS migration[\s\S]*?ARG RELEASE_SHA=unknown[\s\S]*?LABEL org\.opencontainers\.image\.revision="\$\{RELEASE_SHA\}"/);
    expect(dockerfile).toMatch(/FROM node:22-bookworm-slim AS production[\s\S]*?ARG RELEASE_SHA=unknown[\s\S]*?LABEL org\.opencontainers\.image\.revision="\$\{RELEASE_SHA\}"/);
  });

  it('preserves migration-first operation and hardens both runtimes', () => {
    const api = service('jrc-api', 'jrc-migrate');
    const migration = service('jrc-migrate');
    expect(api).toMatch(/jrc-migrate:\s*\n\s+condition: service_completed_successfully/);
    expect(migration).toMatch(/jrc-db:\s*\n\s+condition: service_healthy/);
    for (const body of [api, migration]) {
      expect(body).toContain('read_only: true');
      expect(body).toContain('cap_drop:\n      - ALL');
      expect(body).toContain('no-new-privileges:true');
      expect(body).toMatch(/tmpfs:[\s\S]*?\/tmp:rw,noexec,nosuid,nodev,size=\d+m/);
      expect(body).toMatch(/pids_limit:\s*\d+/);
    }
    expect(api).toContain('jrc-private-storage:/app/storage');
    expect(dockerfile.match(/^USER node$/gm)).toHaveLength(2);
    expect(dockerfile).toContain('HEALTHCHECK');
  });

  it('uses a minimal migration runtime without build toolchain, source, or dev runner', () => {
    expect(dockerfile).toMatch(/FROM node:22-bookworm-slim AS migration/);
    const migration = dockerfile.match(/FROM node:22-bookworm-slim AS migration[\s\S]*?(?=\nFROM .* AS production)/)?.[0] ?? '';
    expect(migration).not.toMatch(/apt-get install[^\n]*(?:python3|make|g\+\+)/);
    expect(migration).not.toContain('COPY . .');
    expect(migration).not.toContain('/app/src');
    expect(migration).not.toContain('tsx');
    expect(migration).toContain('prisma migrate deploy');
  });

  it('documents explicit local values, image Config.Label inspection, and fresh acceptance only', () => {
    expect(readme).not.toMatch(/\*\*(?:60|91|7) passed\*\*/);
    expect(readme).not.toMatch(/has been verified on staging|verified external SMTP/i);
    expect(readme).toMatch(/JRC_API_IMAGE=jrc-api:local/);
    expect(readme).toMatch(/JRC_MIGRATION_IMAGE=jrc-migration:local/);
    expect(readme).toMatch(/docker image inspect/i);
    expect(readme).toMatch(/Config\.Labels/);
    expect(readme).toMatch(/external SMTP/i);
  });
});

describe('production cutover and organizer input contract', () => {
  it('collects every owner-only decision without implicit approval', () => {
    for (const phrase of ['production origin', 'DNS', 'vhost authority', 'event identity', 'event day', 'schedule', 'venue', 'fees', 'currency', 'payment deadline', 'bank', 'QRIS', 'eligibility', 'team', 'quota', 'waitlist', 'refund', 'dispute', 'no-show', 'document checklist', 'review SLA', 'payment SLA', 'contacts', 'privacy', 'retention', 'staff identities', 'scanner devices', 'scanner network', 'alert recipients', 'RTO', 'RPO']) expect(cutover.toLowerCase()).toContain(phrase.toLowerCase());
    expect(cutover).toMatch(/secure delivery channel/i);
    expect(cutover).toMatch(/no default[^.]*approval/i);
    expect(cutover).toMatch(/owner-only/i);
  });

  it('defines complete evidence-led cutover, monitor ownership, and rollback gates', () => {
    for (const phrase of ['schema-first', 'exact SHA', 'immutable image', 'Config.Labels', 'RELEASE_SHA', 'full resolved Apache', 'synthetic query', 'Authorization', 'Cookie', 'log leak', 'backup', 'restore', 'external SMTP', 'readback', 'physical camera', 'atomic switch', 'canary', 'systemd', 'monitor installation owner', 'monitor activation owner', 'rollback decision', 'no-go criteria', 'organizer sign-off']) expect(cutover.toLowerCase()).toContain(phrase.toLowerCase());
    expect(cutover).toMatch(/reject[^\n]*unknown/i);
  });
});
