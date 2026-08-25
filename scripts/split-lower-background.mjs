import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourcePath = path.join(projectRoot, 'public', 'assets', 'background-bawah.svg');
const outputDir = path.join(projectRoot, 'public', 'assets', 'lower-scenes');

const names = [
  'opening',
  'chapter-1',
  'chapter-2',
  'chapter-3',
  'chapter-4',
  'civic',
  'partners',
  'faq',
];

// Resize the desktop painting once, then cut it. Encoding at 2x keeps the
// browser from enlarging a 936px crop across a desktop viewport.
const desktop = {
  width: 2560,
  heights: [1344, 1214, 1214, 1214, 1214, 1668, 2530, 2274],
};

// A literal mobile stretch would make the 3150px painting over five times
// taller and smear the clouds. Mobile uses tall, overlapping editorial crops
// from the same high-resolution render instead.
const mobile = {
  width: 780,
  heights: [1536, 1568, 1568, 1568, 1568, 2080, 2574, 2970],
  centers: [0.07, 0.18, 0.31, 0.44, 0.57, 0.69, 0.82, 0.93],
  cropWidths: [920, 900, 900, 900, 900, 850, 760, 700],
};

const webpOptions = {
  quality: 96,
  nearLossless: true,
  smartSubsample: true,
  effort: 6,
};

await mkdir(outputDir, { recursive: true });

const desktopHeight = desktop.heights.reduce((sum, height) => sum + height, 0);
const desktopMaster = await sharp(sourcePath, { density: 560 })
  .resize(desktop.width, desktopHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
  .removeAlpha()
  .sharpen(0.65)
  .png()
  .toBuffer();

let desktopTop = 0;
for (const [index, name] of names.entries()) {
  const height = desktop.heights[index];
  await sharp(desktopMaster)
    .extract({ left: 0, top: desktopTop, width: desktop.width, height })
    .webp(webpOptions)
    .toFile(path.join(outputDir, `${name}-desktop.webp`));
  desktopTop += height;
}

if (desktopTop !== desktopHeight) {
  throw new Error('Desktop slice verification failed: the cake has a gap or overlap.');
}

const canonicalWidth = 2000;
const canonicalHeight = Math.round(canonicalWidth * (1575 / 468));
const canonical = await sharp(sourcePath, { density: 560 })
  .resize(canonicalWidth, canonicalHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
  .removeAlpha()
  .sharpen(0.55)
  .png()
  .toBuffer();

for (const [index, name] of names.entries()) {
  const outputHeight = mobile.heights[index];
  const cropWidth = mobile.cropWidths[index];
  const cropHeight = Math.min(
    canonicalHeight,
    Math.round(cropWidth * (outputHeight / mobile.width)),
  );
  const centerY = Math.round(mobile.centers[index] * canonicalHeight);
  const top = Math.max(
    0,
    Math.min(canonicalHeight - cropHeight, centerY - Math.round(cropHeight / 2)),
  );
  const left = Math.round((canonicalWidth - cropWidth) / 2);

  await sharp(canonical)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(mobile.width, outputHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .sharpen(0.5)
    .webp(webpOptions)
    .toFile(path.join(outputDir, `${name}-mobile.webp`));
}

console.log(
  `Created ${names.length} contiguous 2x desktop slices and ${names.length} art-directed mobile slices in ${outputDir}`,
);
