import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.QA_BASE ?? 'http://127.0.0.1:20141';
const OUT = process.env.QA_OUT ?? '/root/jrc/qa';
const sizes = [
  { name: '320', width: 320, height: 568, touch: true },
  { name: '375', width: 375, height: 812, touch: true },
  { name: '390', width: 390, height: 844, touch: true },
  { name: '430', width: 430, height: 932, touch: true },
  { name: '768', width: 768, height: 1024, touch: true },
  { name: '980-touch', width: 980, height: 844, touch: true },
  { name: '1280', width: 1280, height: 720, touch: false },
  { name: '1440', width: 1440, height: 900, touch: false },
];

fs.mkdirSync(OUT, { recursive: true });

for (const size of sizes) {
  test(`hero ${size.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/hero-${size.name}.png` });

    const probe = await page.evaluate(() => {
      const q = (s: string) => document.querySelector(s) as HTMLElement | null;
      const box = (s: string) => { const el = q(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const video = document.querySelector('[data-testid="hero-mascot-video"]') as HTMLVideoElement | null;
      const primary = q('.hero-section__actions .site-action--primary');
      const mascot = q('.hero-scene__foreground-video') ?? q('.hero-scene__foreground-image');
      const actions = q('.hero-section__actions');
      const mascotBounds = mascot?.getBoundingClientRect();
      const actionBounds = actions?.getBoundingClientRect();
      const mascotContentBottom = mascotBounds
        ? mascotBounds.top + mascotBounds.height * (1194 / 1280)
        : null;
      return {
        title: box('#hero-title'),
        mascot: box('.hero-scene__foreground-video') ?? box('.hero-scene__foreground-image'),
        actions: box('.hero-section__actions'),
        mascotCtaClearance: mascotContentBottom !== null && actionBounds
          ? Math.round((actionBounds.top - mascotContentBottom) * 100) / 100
          : null,
        engravings: box('.hero-section__engravings'),
        assetCount: document.querySelectorAll('.hero-section__engraving img').length,
        assetComplete: [...document.querySelectorAll('.hero-section__engraving img')].every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0),
        primaryHeight: primary ? Math.round(primary.getBoundingClientRect().height) : 0,
        titleText: q('#hero-title')?.innerText ?? '',
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        videoTime: video?.currentTime ?? -1,
        videoReady: document.querySelector('.hero-scene__foreground-picture')?.getAttribute('data-video-ready'),
      };
    });

    await page.waitForTimeout(1200);
    const later = await page.evaluate(() => (document.querySelector('[data-testid="hero-mascot-video"]') as HTMLVideoElement | null)?.currentTime ?? -1);

    console.log(`PROBE ${size.name} ${JSON.stringify({ ...probe, later, errors })}`);
    expect(probe.overflowX, 'no horizontal overflow').toBeLessThanOrEqual(1);
    expect(probe.title?.w ?? 0).toBeGreaterThan(100);
    expect(probe.assetCount).toBe(2);
    expect(probe.assetComplete).toBe(true);
    expect(errors, 'console errors').toEqual([]);
    if (size.touch) {
      expect(probe.primaryHeight).toBeGreaterThanOrEqual(44);
    }
    if (size.width <= 768) {
      expect(probe.mascotCtaClearance, 'mascot clears the CTA by at least 4px').toBeGreaterThanOrEqual(4);
    }
    if (size.width === 768) {
      expect(probe.mascot?.w, 'tablet mascot width').toBeGreaterThanOrEqual(208);
      expect(probe.mascot?.w, 'tablet mascot width').toBeLessThanOrEqual(240);
    }
    await context.close();
  });
}
