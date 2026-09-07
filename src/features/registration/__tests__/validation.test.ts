import { describe, expect, it } from 'vitest';

import { registrationDraftSchema } from '../validation';

describe('registration form validation', () => {
  it('requires one leader and validates every additional member', () => {
    const result = registrationDraftSchema.safeParse({
      teamName: 'Garuda Robotika',
      institution: 'PENS',
      competitionId: 'sumo',
      leader: { name: 'Ari Wijaya', email: 'ari@example.test', phone: '081234567890' },
      members: [{ name: '', email: 'invalid', phone: '123' }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(expect.arrayContaining([
        'members.0.name',
        'members.0.email',
        'members.0.phone',
      ]));
    }
  });
});