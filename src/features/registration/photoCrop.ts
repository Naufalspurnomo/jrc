export interface CropSource {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateCropSource(
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): CropSource {
  const baseWidth = Math.min(imageWidth, imageHeight * 0.75);
  const baseHeight = baseWidth / 0.75;
  const width = baseWidth / zoom;
  const height = baseHeight / zoom;
  const maxX = imageWidth - width;
  const maxY = imageHeight - height;
  return {
    x: Math.min(maxX, Math.max(0, maxX / 2 + offsetX * maxX / 2)),
    y: Math.min(maxY, Math.max(0, maxY / 2 + offsetY * maxY / 2)),
    width,
    height,
  };
}

export function safePhotoFilename(subjectName: string): string {
  const stem = subjectName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'foto-anggota';
  return `${stem}-900x1200.jpg`;
}

export async function loadCropImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await image.decode();
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

export function canvasToJpegFile(canvas: HTMLCanvasElement, subjectName: string): Promise<File> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('Hasil crop gagal dibuat.'));
      return;
    }
    resolve(new File([blob], safePhotoFilename(subjectName), { type: 'image/jpeg', lastModified: Date.now() }));
  }, 'image/jpeg', 0.92));
}
