import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByAltText('Maskot robot gladiator JRC XIV di arena Roma')).toHaveAttribute(
      'src',
      HERO_ASSETS.foregroundFallback,
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

  it('never mounts WebGL automatically after first interaction', () => {
    render(<HeroExperience />);
    fireEvent.pointerDown(window);
    fireEvent.wheel(window);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(screen.queryByTestId('hero-webgl-canvas')).not.toBeInTheDocument();
  });

  it('declares responsive foreground sources and both depth hints', () => {
    expect(HERO_ASSETS).toEqual(
      expect.objectContaining({
        background: '/assets/hero-rome-wide.webp',
        foreground: '/assets/brand/jrc14-gladiator-mascot.webp',
        foregroundMedium: '/assets/brand/jrc14-gladiator-mascot.webp',
        foregroundSmall: '/assets/brand/jrc14-gladiator-mascot.webp',
        backgroundDepth: '/assets/hero-rome-depth.png',
        foregroundDepth: '/assets/batu-knight-depth.png',
      }),
    );
  });
});
