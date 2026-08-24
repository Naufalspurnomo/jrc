import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const sizes = [[320,568],[390,844],[568,320],[768,1024],[1024,768],[1440,900],[2560,1440]];
const out = 'audit-responsive/schedule-editorial';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
for (const [width,height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:20131/', { waitUntil: 'networkidle' });
  await page.locator('#jadwal').scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const geometry = await page.evaluate(() => {
    const section = document.querySelector('#jadwal');
    const first = document.querySelector('.schedule-route__stations li');
    const title = document.querySelector('#schedule-title');
    const images = [...section.querySelectorAll('img')];
    const sr = section.getBoundingClientRect(), fr = first.getBoundingClientRect(), tr = title.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollWidth > innerWidth,
      sectionOverflow: section.scrollWidth > section.clientWidth,
      section: { width: sr.width, height: sr.height },
      title: { top: tr.top, bottom: tr.bottom, width: tr.width, visible: getComputedStyle(title).visibility, opacity: getComputedStyle(title).opacity },
      first: { top: fr.top, bottom: fr.bottom, width: fr.width, visible: getComputedStyle(first).visibility, opacity: getComputedStyle(first).opacity },
      loadedImages: images.map(i => ({ src: i.currentSrc, loaded: i.complete && i.naturalWidth > 0 })),
    };
  });
  await page.locator('#jadwal').screenshot({ path: `${out}/${width}x${height}.png` });
  results.push({ width, height, errors, ...geometry });
  await page.close();
}
await browser.close();
await fs.writeFile(`${out}/geometry.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
