import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import HeroExperience, {
  HERO_ASSETS,
  hasWebGLSupport,
} from './HeroExperience';

describe('HeroExperience', () => {
  it('keeps the static artwork visible while WebGL is unavailable', () => {
    render(<HeroExperience forceStatic />);

    const fallback = screen.getByTestId('hero-static-fallback');
    expect(fallback).toBeVisible();
    expect(screen.getByAltText('Arena Roma: raksasa batu melawan Ksatria JRC XIV')).toHaveAttribute(
      'src',
      HERO_ASSETS.foreground,
    );
    expect(screen.queryByTestId('hero-webgl-canvas')).not.toBeInTheDocument();
  });

  it('checks WebGL without throwing when canvas creation fails', () => {
    const createElement = vi.spyOn(document, 'createElement').mockImplementation(() => {
      throw new Error('canvas disabled');
    });

    expect(hasWebGLSupport()).toBe(false);
    createElement.mockRestore();
  });

  it('declares responsive foreground sources and both depth hints', () => {
    expect(HERO_ASSETS).toEqual(
      expect.objectContaining({
        background: '/assets/hero-rome-wide.webp',
        foreground: '/assets/batu-knight-1920.webp',
        foregroundMedium: '/assets/batu-knight-1280.webp',
        foregroundSmall: '/assets/batu-knight-960.webp',
        backgroundDepth: '/assets/hero-rome-depth.png',
        foregroundDepth: '/assets/batu-knight-depth.png',
      }),
    );
  });
});
