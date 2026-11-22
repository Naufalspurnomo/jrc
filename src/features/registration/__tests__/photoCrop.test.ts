import { describe, expect, it } from 'vitest';

import { calculateCropSource, safePhotoFilename } from '../photoCrop';

describe('member photo crop helpers', () => {
  it('centers and constrains a landscape image to 3:4', () => {
    expect(calculateCropSource(1600, 900, 1, 0, 0)).toEqual({
      x: 462.5,
      y: 0,
      width: 675,
      height: 900,
    });
  });

  it('applies zoom and normalized offsets without leaving the image', () => {
    expect(calculateCropSource(900, 1600, 2, 1, -1)).toEqual({
      x: 450,
      y: 0,
      width: 450,
      height: 600,
    });
  });

  it('creates a safe jpeg filename', () => {
    expect(safePhotoFilename('  Ari Wijaya / Ketua  ')).toBe('ari-wijaya-ketua-900x1200.jpg');
  });
});
