import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const serverRoot = resolve(process.cwd());

function envValue(source: string, name: string): string {
  const match = source.match(new RegExp(`^${name}=(.+)$`, 'm'));
  if (match?.[1] === undefined) throw new Error(`${name} is missing`);
  return match[1].trim();
}

function exportedString(source: string, name: string): string {
  const match = source.match(new RegExp(`export const ${name}\\s*=\\s*['"]([^'"]+)['"]`));
  if (match?.[1] === undefined) throw new Error(`${name} is missing`);
  return match[1];
}

describe('seed registration deadline contract', () => {
  it('exactly matches the server and frontend public deadline instead of December', () => {
    const seedSource = readFileSync(resolve(serverRoot, 'prisma/seed.ts'), 'utf8');
    const exampleEnv = readFileSync(resolve(serverRoot, '.env.example'), 'utf8');
    const frontendContent = readFileSync(resolve(serverRoot, '../src/content/jrc.ts'), 'utf8');
    const fallbackMatch = seedSource.match(
      /dateTimeEnv\(\s*['"]REGISTRATION_DEADLINE['"]\s*,\s*['"]([^'"]+)['"]\s*,?\s*\)/,
    );
    const fallback = fallbackMatch?.[1];

    expect(fallback).toBe(envValue(exampleEnv, 'REGISTRATION_DEADLINE'));
    expect(fallback).toBe(exportedString(frontendContent, 'registrationDeadline'));
    expect(fallback).toBe('2026-10-15T23:59:59+07:00');
    expect(fallback).not.toMatch(/-12-/);
  });
});
