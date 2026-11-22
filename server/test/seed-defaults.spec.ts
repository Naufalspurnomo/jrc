import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('official competition fee defaults', () => {
  it('uses IDR 250000 for all six seed defaults and configuration examples', () => {
    const seed = readFileSync(resolve(process.cwd(), 'prisma/seed.ts'), 'utf8');
    const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');

    expect([...seed.matchAll(/defaultFee:\s*([\d_]+)/g)].map((match) => match[1])).toEqual(
      Array(6).fill('250_000'),
    );
    expect([...envExample.matchAll(/^(?:TRANSPORTER_SD|RESCUE_SMP|SHOOTER_SMA|LINE_FOLLOWER|SUMO|SOCCER)_FEE=(\d+)$/gm)]
      .map((match) => match[1])).toEqual(Array(6).fill('250000'));
  });
});