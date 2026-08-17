import { Buffer } from 'node:buffer';
import console from 'node:console';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'public', 'assets');

async function createWideSet(inputName, outputName) {
  const input = path.join(assets, inputName);
  const base = sharp(input).resize(3840, 2160, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 });

  await Promise.all([
    base.clone().avif({ quality: 74, effort: 6 }).toFile(path.join(assets, `${outputName}.avif`)),
    base.clone().webp({ quality: 88, smartSubsample: true }).toFile(path.join(assets, `${outputName}.webp`)),
    sharp(input)
      .resize(1440, 1920, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
      .webp({ quality: 84, smartSubsample: true })
      .toFile(path.join(assets, `${outputName}-mobile.webp`)),
  ]);
}

async function createDepthHints() {
  const backgroundDepth = Buffer.from(`
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#161616"/>
          <stop offset="0.48" stop-color="#303030"/>
          <stop offset="0.68" stop-color="#8c8c8c"/>
          <stop offset="1" stop-color="#f2f2f2"/>
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#depth)"/>
    </svg>
  `);

  await Promise.all([
    sharp(backgroundDepth).png().toFile(path.join(assets, 'hero-rome-depth.png')),
    sharp(path.join(assets, 'batu-knight.png'))
      .ensureAlpha()
      .extractChannel('alpha')
      .blur(8)
      .linear(0.76, 26)
      .png()
      .toFile(path.join(assets, 'batu-knight-depth.png')),
  ]);
}

await Promise.all([
  createWideSet('hero-rome-wide-source.png', 'hero-rome-wide'),
  createWideSet('arena-interior-wide-source.png', 'arena-interior-wide'),
  sharp(path.join(assets, 'batu-knight.png'))
    .resize(2880, 2346, { kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 94, alphaQuality: 100, smartSubsample: true })
    .toFile(path.join(assets, 'batu-knight@2x.webp')),
  createDepthHints(),
]);

const checks = [
  ['hero-rome-wide.webp', 3840, 2160],
  ['arena-interior-wide.webp', 3840, 2160],
  ['batu-knight@2x.webp', 2880, 2346],
];

for (const [file, width, height] of checks) {
  const metadata = await sharp(path.join(assets, file)).metadata();
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(`${file} has ${metadata.width}x${metadata.height}, expected ${width}x${height}`);
  }
  console.log(`${file}: ${metadata.width}x${metadata.height}`);
}
