import { Buffer } from 'node:buffer';
import console from 'node:console';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'public', 'assets');
const sourceAssets = path.join(root, 'asset', 'generated-source');

async function createWideSet(inputName, outputName) {
  const input = path.join(sourceAssets, inputName);
  const base = sharp(input).resize(3840, 2160, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 });
  const isHero = outputName === 'hero-rome-wide';

  await Promise.all([
    sharp(input)
      .resize(isHero ? 2560 : 3840, isHero ? 1440 : 2160, {
        fit: 'cover',
        position: 'centre',
        kernel: sharp.kernel.lanczos3,
      })
      .avif({ quality: isHero ? 55 : 74, effort: 6 })
      .toFile(path.join(assets, `${outputName}.avif`)),
    base.clone().webp({ quality: 88, smartSubsample: true }).toFile(path.join(assets, `${outputName}.webp`)),
    sharp(input)
      .resize(isHero ? 720 : 1440, isHero ? 960 : 1920, {
        fit: 'cover',
        position: 'centre',
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: isHero ? 76 : 84, effort: 6, smartSubsample: true })
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

async function optimizeRomanSelectionPlates() {
  const names = ['athena', 'ares', 'apollo', 'antinous', 'meleager', 'hercules'];
  await Promise.all(names.map(async (name) => {
    const file = path.join(assets, 'roman-select', `${name}.webp`);
    const optimized = await sharp(file)
      .resize({ width: 700, withoutEnlargement: true })
      .webp({ quality: 76, effort: 6, smartSubsample: true })
      .toBuffer();
    await sharp(optimized).toFile(file);
  }));
}

async function createForegroundComposite() {
  const width = 2880;
  const height = 2346;
  const edgeFeather = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="white" stop-opacity="0"/>
          <stop offset="0.055" stop-color="white" stop-opacity="1"/>
          <stop offset="0.945" stop-color="white" stop-opacity="1"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#edge)"/>
    </svg>
  `);

  await sharp(path.join(assets, 'batu-knight.png'))
    .resize(width, height, { kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .composite([{ input: edgeFeather, blend: 'dest-in' }])
    .webp({ quality: 94, alphaQuality: 100, smartSubsample: true })
    .toFile(path.join(assets, 'batu-knight@2x.webp'));
}

await Promise.all([
  createWideSet('hero-rome-wide-source.png', 'hero-rome-wide'),
  createWideSet('arena-interior-wide-source.png', 'arena-interior-wide'),
  createForegroundComposite(),
  createDepthHints(),
  optimizeRomanSelectionPlates(),
]);

const checks = [
  ['hero-rome-wide.avif', 2560, 1440],
  ['hero-rome-wide-mobile.webp', 720, 960],
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
