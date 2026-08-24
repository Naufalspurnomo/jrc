import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HomePage from './HomePage';

const motionControllerRender = vi.hoisted(() => vi.fn());
const defaultMatchMedia = window.matchMedia;

vi.mock('../scene/HeroExperience', () => ({
  default: () => <div data-testid="hero-experience" aria-hidden="true" />,
}));

vi.mock('../components/motion/DesktopMotionController', () => ({
  default: () => {
    motionControllerRender();
    return <div data-testid="desktop-motion-controller" />;
  },
}));

function setMotionEnvironment({
  width,
  touchPoints,
  reducedMotion,
}: {
  width: number;
  touchPoints: number;
  reducedMotion: boolean;
}) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: touchPoints });
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

afterEach(() => {
  motionControllerRender.mockClear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  window.matchMedia = defaultMatchMedia;
});

describe('HomePage desktop motion loading', () => {
  it('keeps the motion controller unloaded on touch mobile after interaction', () => {
    setMotionEnvironment({ width: 390, touchPoints: 1, reducedMotion: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    fireEvent.pointerDown(window);

    expect(screen.queryByTestId('desktop-motion-controller')).not.toBeInTheDocument();
    expect(motionControllerRender).not.toHaveBeenCalled();
  });

  it('does not load the motion controller from the first desktop interaction', () => {
    setMotionEnvironment({ width: 1440, touchPoints: 0, reducedMotion: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    fireEvent.pointerDown(window);
    fireEvent.wheel(window);

    expect(screen.queryByTestId('desktop-motion-controller')).not.toBeInTheDocument();
    expect(motionControllerRender).not.toHaveBeenCalled();
  });

  it('keeps the motion controller unloaded for reduced-motion desktop users', () => {
    setMotionEnvironment({ width: 1440, touchPoints: 0, reducedMotion: true });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    fireEvent.pointerDown(window);

    expect(screen.queryByTestId('desktop-motion-controller')).not.toBeInTheDocument();
    expect(motionControllerRender).not.toHaveBeenCalled();
  });
});
