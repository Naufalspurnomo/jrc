import { describe, expect, it } from 'vitest';

import { competitions, faqItems } from './jrc';

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

  it('publishes the official per-team fee and contact for every category', () => {
    expect(competitions.map(({ level, discipline, fee, contact }) => ({
      level,
      discipline,
      fee,
      contact,
    }))).toEqual([
      { level: 'SD', discipline: 'Transporter', fee: 'Rp 250.000 per tim', contact: { name: 'Naya', phone: '0878-4132-4886' } },
      { level: 'SMP', discipline: 'Rescue Transporter', fee: 'Rp 250.000 per tim', contact: { name: 'Manda', phone: '0857-5540-9648' } },
      { level: 'SMA', discipline: 'Transporter Shooter', fee: 'Rp 250.000 per tim', contact: { name: 'Aisyah', phone: '0881-0360-87367' } },
      { level: 'Umum', discipline: 'Line Follower Mikro', fee: 'Rp 250.000 per tim', contact: { name: 'Alzar', phone: '0813-3002-5557' } },
      { level: 'Umum', discipline: 'Sumo', fee: 'Rp 250.000 per tim', contact: { name: 'Nadjwa', phone: '0888-5454-111' } },
      { level: 'Umum', discipline: 'Soccer', fee: 'Rp 250.000 per tim', contact: { name: 'Rissa', phone: '0851-1954-6428' } },
    ]);

    expect(faqItems.at(-1)?.answer).toContain('Naya 0878-4132-4886');
    expect(faqItems.at(-1)?.answer).toContain('Rissa 0851-1954-6428');
  });
});