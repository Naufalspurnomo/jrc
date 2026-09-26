import { describe, expect, it } from 'vitest';

import { competitions } from './jrc';

describe('JRC XIV competition catalog', () => {
  it('pairs stable competition identities with the exact arena, level, and discipline mapping', () => {
    expect(competitions.map(({ slug, name, shortName, level, discipline, emblem }) => ({
      slug,
      name,
      shortName,
      level,
      discipline,
      emblem,
    }))).toEqual([
      {
        slug: 'donatopia-transporter',
        name: 'Castra — Transporter',
        shortName: 'CASTRA',
        level: 'SD',
        discipline: 'Transporter',
        emblem: {
          src: '/assets/arena-emblems/aquaduct-romana.webp',
          alt: 'Lambang CASTRA',
        },
      },
      {
        slug: 'nightmaze-rescue-transporter',
        name: 'Robo Chiper — Rescue Transporter',
        shortName: 'ROBO CHIPER',
        level: 'SMP',
        discipline: 'Rescue Transporter',
        emblem: {
          src: '/assets/arena-emblems/castra-guardian.webp',
          alt: 'Lambang ROBO CHIPER',
        },
      },
      {
        slug: 'pirate-clash-transporter-shooter',
        name: 'Aquaduct — Transporter Shooter',
        shortName: 'AQUADUCT',
        level: 'SMA',
        discipline: 'Transporter Shooter',
        emblem: {
          src: '/assets/arena-emblems/robo-chiper.webp',
          alt: 'Lambang AQUADUCT',
        },
      },
      {
        slug: 'wacky-rally-line-follower-mikro',
        name: 'Charion Line — Line Follower Mikro',
        shortName: 'CHARION LINE',
        level: 'Umum',
        discipline: 'Line Follower Mikro',
        emblem: {
          src: '/assets/arena-emblems/chariot-line.webp',
          alt: 'Lambang CHARION LINE',
        },
      },
      {
        slug: 'ring-rumble-sumo',
        name: 'Colosseum — Sumo',
        shortName: 'COLOSSEUM',
        level: 'Umum',
        discipline: 'Sumo',
        emblem: {
          src: '/assets/arena-emblems/colosseum-clash.webp',
          alt: 'Lambang COLOSSEUM',
        },
      },
      {
        slug: 'goal-rush-soccer',
        name: 'Harpastum — Soccer',
        shortName: 'HARPASTUM',
        level: 'Umum',
        discipline: 'Soccer',
        emblem: {
          src: '/assets/arena-emblems/harpastum-arena.webp',
          alt: 'Lambang HARPASTUM',
        },
      },
    ]);
  });
});