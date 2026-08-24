import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = '/root/jrc/artifacts';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:20130/', { waitUntil: 'networkidle' });
  await page.locator('[data-testid="entry-gate"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  const image = page.locator('.hero-scene__foreground-image');
  await image.waitFor({ state: 'visible' });
  const geometry = await image.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hero = el.closest('.hero-scene')?.getBoundingClientRect();
    const headline = document.querySelector('h1')?.getBoundingClientRect();
    return {
      mascot: { x: r.x, y: r.y, width: r.width, height: r.height, right: innerWidth-r.right, bottom: innerHeight-r.bottom },
      hero: hero && { x: hero.x, y: hero.y, width: hero.width, height: hero.height },
      headline: headline && { x: headline.x, y: headline.y, width: headline.width, height: headline.height },
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: innerWidth },
      fullHeadVisible: r.top >= 0,
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
      mascotViewportAreaRatio: (r.width * r.height) / (innerWidth * innerHeight),
    };
  });
  const path = `${out}/hero-${viewport.width}x${viewport.height}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(JSON.stringify({ viewport, path, geometry, errors }));
  await page.close();
}
await browser.close();
