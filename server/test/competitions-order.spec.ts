import { PrismaService } from '../src/prisma.service';
import { CompetitionsController } from '../src/app.module';
import { describe, expect, it, vi } from 'vitest';

type CompetitionStub = {
  slug: string;
  registrationDeadline: Date;
};

const CANONICAL_SLUGS = [
  'donatopia-transporter',
  'nightmaze-rescue-transporter',
  'pirate-clash-transporter-shooter',
  'wacky-rally-line-follower-mikro',
  'ring-rumble-sumo',
  'goal-rush-soccer',
];

function competition(
  slug: string,
  registrationDeadline = new Date('2026-12-31T16:59:59.000Z'),
): CompetitionStub {
  return { slug, registrationDeadline };
}

describe('CompetitionsController', () => {
  it('orders each deadline by canonical slug rank then deterministic unknown-slug fallback', async () => {
    const earlierDeadline = new Date('2026-11-30T16:59:59.000Z');
    const competitions = [
      competition('zeta-future-arena'),
      competition('ring-rumble-sumo'),
      competition('goal-rush-soccer'),
      competition('alpha-future-arena'),
      competition('nightmaze-rescue-transporter'),
      competition('pirate-clash-transporter-shooter'),
      competition('wacky-rally-line-follower-mikro'),
      competition('donatopia-transporter'),
      competition('earlier-future-arena', earlierDeadline),
    ];
    const prisma = {
      competition: { findMany: vi.fn().mockResolvedValue(competitions) },
    } as unknown as PrismaService;

    const result = await new CompetitionsController(prisma).list();

    expect(result.map(({ slug }) => slug)).toEqual([
      'earlier-future-arena',
      ...CANONICAL_SLUGS,
      'alpha-future-arena',
      'zeta-future-arena',
    ]);
  });
});
