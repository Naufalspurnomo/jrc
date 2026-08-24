import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourceDir = new URL('./hero-assets/research/', import.meta.url);
const outputDir = new URL('../public/assets/hero-roman/', import.meta.url);
await mkdir(outputDir, { recursive: true });

const palette = { ink: '#1E1713', terracotta: '#9E6032', parchment: '#E8D4A1' };

// Preserve etched detail while replacing the scanned paper with JRC parchment.
const colosseum = sharp(fileURLToPath(new URL('colosseum-a.jpg', sourceDir)))
  .extract({ left: 20, top: 24, width: 1240, height: 810 })
  .resize({ width: 1600, withoutEnlargement: false })
  .grayscale()
  .linear(1.12, -12)
  .tint(palette.terracotta)
  .modulate({ brightness: 1.03, saturation: 0.72 });
await Promise.all([
  colosseum.clone().webp({ quality: 78, effort: 6 }).toFile(fileURLToPath(new URL('colosseum-engraving.webp', outputDir))),
  colosseum.clone().avif({ quality: 52, effort: 7 }).toFile(fileURLToPath(new URL('colosseum-engraving.avif', outputDir))),
]);

// Convert light paper to transparency. A soft alpha curve keeps fine engraving strokes.
const archBase = sharp(fileURLToPath(new URL('arch-b.jpg', sourceDir)))
  .extract({ left: 78, top: 28, width: 1138, height: 1960 })
  .resize({ height: 1500, withoutEnlargement: true })
  .grayscale()
  .linear(1.22, -25);
const { data: archGray, info } = await archBase.clone().raw().toBuffer({ resolveWithObject: true });
const alpha = Buffer.alloc(archGray.length);
for (let i = 0; i < archGray.length; i += 1) {
  const darkness = 255 - archGray[i];
  alpha[i] = Math.max(0, Math.min(210, Math.round((darkness - 7) * 2.25)));
}
const rgba = Buffer.alloc(info.width * info.height * 4);
for (let i = 0; i < alpha.length; i += 1) {
  const offset = i * 4;
  rgba[offset] = 30;
  rgba[offset + 1] = 23;
  rgba[offset + 2] = 19;
  rgba[offset + 3] = alpha[i];
}
await Promise.all([
  sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 82, alphaQuality: 88, effort: 6 }).toFile(fileURLToPath(new URL('triumphal-arch.webp', outputDir))),
  sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).avif({ quality: 58, effort: 7, chromaSubsampling: '4:4:4' }).toFile(fileURLToPath(new URL('triumphal-arch.avif', outputDir))),
]);

console.log(`Created hero engravings: colosseum 1600px wide; arch ${info.width}x${info.height}px.`);
