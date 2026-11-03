import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('official static hosting policy', () => {
  it('ships the SPA fallback and browser security headers with the build', async () => {
    const policy = await readFile(`${process.cwd()}/public/.htaccess`, 'utf8');

    expect(policy).toContain('RewriteRule ^ index.html [L]');
    expect(policy).toContain('Strict-Transport-Security');
    expect(policy).toContain('Content-Security-Policy');
    expect(policy).toContain("img-src 'self' data: blob: https:");
    expect(policy).toContain("connect-src 'self' https://api.jrc.pens.ac.id");
    expect(policy).toContain("media-src 'self' blob:");
  });
});
