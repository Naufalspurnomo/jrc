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

  it('does not fabricate dates that have not been officially confirmed', () => {
    expect(eventFacts.registration).toBe('Akan diumumkan');
    expect(eventFacts.eventDate).toBe('Akan diumumkan');
    expect(eventSchedule.every((item) => item.date === 'Akan diumumkan')).toBe(true);
  });
});
