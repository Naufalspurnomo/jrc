import { describe, expect, it } from 'vitest';

import { HealthController } from '../src/app.module';
import type { PrismaService } from '../src/prisma.service';

describe('health release provenance', () => {
  it('exposes the Render commit without touching the database', () => {
    const previous = process.env.RENDER_GIT_COMMIT;
    process.env.RENDER_GIT_COMMIT = 'a'.repeat(40);
    try {
      const controller = new HealthController({} as PrismaService);
      expect(controller.release()).toEqual({ commit: 'a'.repeat(40) });
    } finally {
      if (previous === undefined) delete process.env.RENDER_GIT_COMMIT;
      else process.env.RENDER_GIT_COMMIT = previous;
    }
  });
});