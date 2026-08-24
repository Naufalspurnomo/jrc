import { chromium } from '@playwright/test';
import fs from 'node:fs';

const target = process.env.QA_URL ?? 'http://127.0.0.1:4174/';
const out = '/root/jrc/artifacts/mobile-hero';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const cases = [
  { width: 320, height: 568, touch: true },
  { width: 375, height: 667, touch: true },
  { width: 390, height: 844, touch: true },
  { width: 430, height: 932, touch: true },
  { width: 980, height: 844, touch: true },
];
let failed = false;
for (const item of cases) {
  const context = await browser.newContext({ viewport: item, hasTouch: item.touch, isMobile: false });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(target, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="entry-gate"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  const video = page.locator('[data-testid="hero-mascot-video"]');
  await video.waitFor({ state: 'attached' });
  await page.waitForFunction(() => { const v = document.querySelector('[data-testid="hero-mascot-video"]'); return v && v.readyState >= 3 && !v.paused && v.currentTime > .1; });
  const before = await video.evaluate(v => v.currentTime);
  await page.waitForTimeout(350);
  const after = await video.evaluate(v => v.currentTime);
  const geometry = await page.evaluate(() => {
    const box = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    const title = box('.hero-section__title-lockup');
    const mascot = box('.hero-scene__foreground-video');
    const actions = box('.hero-section__actions');
    const standard = document.querySelector('.hero-section__standard');
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      hero: box('.hero-section'), title, mascot, actions,
      overlap: title && mascot ? Math.max(0, Math.min(title.right, mascot.right) - Math.max(title.left, mascot.left)) * Math.max(0, Math.min(title.bottom, mascot.bottom) - Math.max(title.top, mascot.top)) : 0,
      actionContained: !!actions && actions.left >= 15 && actions.right <= innerWidth - 15,
      mascotCrop: mascot ? Math.max(0, -mascot.left) + Math.max(0, mascot.right - innerWidth) : 0,
      standardDisplay: standard ? getComputedStyle(standard).display : null,
    };
  });
  const mobile = item.width <= 768;
  const ok = geometry.overflow === 0 && geometry.overlap === 0 && geometry.actionContained && geometry.mascotCrop <= (mobile ? 8 : 0) && (!mobile || geometry.standardDisplay === 'none') && after > before && errors.length === 0;
  failed ||= !ok;
  const screenshot = `${out}/${item.width}x${item.height}-touch.png`;
  await page.screenshot({ path: screenshot });
  console.log(JSON.stringify({ viewport: item, ok, geometry, video: { before, after, advanced: after > before }, errors, screenshot }));
  await context.close();
}
await browser.close();
if (failed) process.exitCode = 1;
