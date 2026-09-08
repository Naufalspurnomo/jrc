import { describe, expect, it } from 'vitest';

import { competitions } from './jrc';

describe('JRC XIV competition catalog', () => {
  it('pairs stable competition identities with the six synchronized arena names and emblems', () => {
    expect(competitions.map(({ slug, name, shortName, emblem }) => ({
      slug,
      name,
      shortName,
      emblem,
    }))).toEqual([
      {
        slug: 'donatopia-transporter',
        name: 'Aquaduct Romana — Transporter',
        shortName: 'AQUADUCT ROMANA',
        emblem: {
          src: '/assets/arena-emblems/aquaduct-romana.webp',
          alt: 'Lambang AQUADUCT ROMANA',
        },
      },
      {
        slug: 'nightmaze-rescue-transporter',
        name: 'Castra Guardian — Rescue Transporter',
        shortName: 'CASTRA GUARDIAN',
        emblem: {
          src: '/assets/arena-emblems/castra-guardian.webp',
          alt: 'Lambang CASTRA GUARDIAN',
        },
      },
      {
        slug: 'pirate-clash-transporter-shooter',
        name: 'Robo-Chiper — Transporter Shooter',
        shortName: 'ROBO-CHIPER',
        emblem: {
          src: '/assets/arena-emblems/robo-chiper.webp',
          alt: 'Lambang ROBO-CHIPER',
        },
      },
      {
        slug: 'wacky-rally-line-follower-mikro',
        name: 'Chariot Line — Line Follower Mikro',
        shortName: 'CHARIOT LINE',
        emblem: {
          src: '/assets/arena-emblems/chariot-line.webp',
          alt: 'Lambang CHARIOT LINE',
        },
      },
      {
        slug: 'ring-rumble-sumo',
        name: 'Colosseum Clash — Sumo',
        shortName: 'COLOSSEUM CLASH',
        emblem: {
          src: '/assets/arena-emblems/colosseum-clash.webp',
          alt: 'Lambang COLOSSEUM CLASH',
        },
      },
      {
        slug: 'goal-rush-soccer',
        name: 'Harpastum Arena — Soccer',
        shortName: 'HARPASTUM ARENA',
        emblem: {
          src: '/assets/arena-emblems/harpastum-arena.webp',
          alt: 'Lambang HARPASTUM ARENA',
        },
      },
    ]);
  });
});