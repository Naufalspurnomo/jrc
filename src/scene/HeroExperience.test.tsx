import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HeroExperience, {
  HERO_ASSETS,
  hasWebGLSupport,
} from './HeroExperience';

const defaultMatchMedia = window.matchMedia;

function setReducedMotion(reducedMotion: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' && reducedMotion,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function setSaveData(saveData: boolean) {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: { saveData },
  });
}

afterEach(() => {
  window.matchMedia = defaultMatchMedia;
  Reflect.deleteProperty(navigator, 'connection');
});

describe('HeroExperience', () => {
  it('renders the animated mascot over the static fallback by default', () => {
    render(<HeroExperience />);

    expect(screen.getByAltText('Maskot robot gladiator JRC XIV di arena Roma')).toHaveAttribute(
      'src',
      HERO_ASSETS.foregroundFallback,
    );

    const video = screen.getByTestId('hero-mascot-video') as HTMLVideoElement;
    expect(video).toHaveAttribute('src', HERO_ASSETS.foregroundVideo);
    expect(video).toHaveAttribute('aria-hidden', 'true');
    expect(video.autoplay).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
  });

  it('crossfades to the animated mascot only after canplay', () => {
    render(<HeroExperience />);

    const video = screen.getByTestId('hero-mascot-video');
    const foreground = video.closest('.hero-scene__foreground-picture');
    expect(foreground).toHaveAttribute('data-video-ready', 'false');

    fireEvent.canPlay(video);

    expect(foreground).toHaveAttribute('data-video-ready', 'true');
  });

  it('removes a failed video and keeps the static fallback visible', () => {
    render(<HeroExperience />);

    const video = screen.getByTestId('hero-mascot-video');
    fireEvent.canPlay(video);
    fireEvent.error(video);

    expect(screen.queryByTestId('hero-mascot-video')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-static-fallback')).toBeVisible();
    expect(screen.getByAltText('Maskot robot gladiator JRC XIV di arena Roma')).toBeVisible();
    expect(document.querySelector('.hero-scene__foreground-picture')).toHaveAttribute(
      'data-video-ready',
      'false',
    );
  });

  it('keeps the mascot static when forceStatic is enabled', () => {
    render(<HeroExperience forceStatic />);

    expect(screen.getByTestId('hero-static-fallback')).toBeVisible();
    expect(screen.queryByTestId('hero-mascot-video')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-webgl-canvas')).not.toBeInTheDocument();
  });

  it('keeps the mascot static when reduced motion is preferred', () => {
    setReducedMotion(true);

    render(<HeroExperience />);

    expect(screen.getByTestId('hero-static-fallback')).toBeVisible();
    expect(screen.queryByTestId('hero-mascot-video')).not.toBeInTheDocument();
  });

  it('keeps the mascot static when Save-Data is enabled', () => {
    setSaveData(true);

    render(<HeroExperience />);

    expect(screen.getByTestId('hero-static-fallback')).toBeVisible();
    expect(screen.queryByTestId('hero-mascot-video')).not.toBeInTheDocument();
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
        foregroundVideo: '/assets/mascot/jrc14-gladiator-alpha.webm',
        backgroundDepth: '/assets/hero-rome-depth.png',
        foregroundDepth: '/assets/batu-knight-depth.png',
      }),
    );
  });
});
