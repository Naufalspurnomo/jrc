import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const expectedCatalog = [
  ['donatopia-transporter', 'Castra Guardian'],
  ['nightmaze-rescue-transporter', 'Robo Chiper'],
  ['pirate-clash-transporter-shooter', 'Aquaduct Romana'],
  ['wacky-rally-line-follower-mikro', 'Charion Line'],
  ['ring-rumble-sumo', 'Colosseum Clash'],
  ['goal-rush-soccer', 'Harpastum Arena'],
] as const;

describe('final competition display names', () => {
  it('keeps seed and production migration synchronized without discipline suffixes', () => {
    const seed = readFileSync(resolve(process.cwd(), 'prisma/seed.ts'), 'utf8');
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20260929173000_final_competition_display_names/migration.sql',
      ),
      'utf8',
    );

    for (const [slug, name] of expectedCatalog) {
      expect(seed).toContain(`slug: '${slug}'`);
      expect(seed).toContain(`name: '${name}'`);
      expect(migration).toContain(`('${slug}', '${name}')`);
    }

    expect(seed).not.toMatch(/name:\s*['"][^'"]+ — (?:Transporter|Rescue Transporter|Transporter Shooter|Line Follower Mikro|Sumo|Soccer)['"]/);
  });

  it('keeps the final SMA discipline synchronized with the pending production migration', () => {
    const seed = readFileSync(resolve(process.cwd(), 'prisma/seed.ts'), 'utf8');
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20260929203000_sma_transporter_line_follower/migration.sql',
      ),
      'utf8',
    );

    expect(seed).toContain("discipline: 'Transporter Line Follower'");
    expect(migration).toContain("'Transporter Line Follower'");
    expect(migration).toContain("'Aquaduct Romana'");
  });
});