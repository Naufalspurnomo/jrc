import { describe, expect, it } from 'vitest';

import { competitions, eventFacts, eventSchedule } from './jrc';

describe('JRC XIV public content', () => {
  it('exposes exactly six clearly-labelled draft competition fixtures', () => {
    expect(competitions).toHaveLength(6);
    expect(competitions.map((competition) => competition.name)).toEqual([
      'Donatopia — Transporter',
      'Nightmaze — Rescue Transporter',
      'Pirate Clash — Transporter Shooter',
      'Wacky Rally — Line Follower Mikro',
      'Ring Rumble — Sumo',
      'Goal Rush — Soccer',
    ]);

    for (const competition of competitions) {
      expect(competition.fixtureLabel).toBe('Draf kategori JRC XIII');
      expect(competition.fee).toBe('Akan diumumkan');
      expect(competition.guidebook.status).toBe('Akan diumumkan');
      expect(competition.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('exposes the confirmed registration deadline while keeping other dates pending', () => {
    expect(eventFacts.registration).toBe('15 September–15 Oktober 2026');
    expect(eventFacts.eventDate).toBe('Akan diumumkan');
    expect(eventSchedule[0]?.date).toBe(eventFacts.registration);
    expect(eventSchedule.slice(1).every((item) => item.date === 'Akan diumumkan')).toBe(true);
  });
});
