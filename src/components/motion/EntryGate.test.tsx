import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import EntryGate from './EntryGate';

describe('EntryGate', () => {
  it('shows the complete logo for the full opening lifecycle, then unmounts', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<EntryGate duration={1600} reducedMotion={false} onComplete={onComplete} />);

    const gate = screen.getByTestId('entry-gate');
    expect(gate).toHaveAttribute('aria-hidden', 'true');
    expect(gate).toHaveStyle({ pointerEvents: 'none' });
    expect(gate.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/brand/jrc14-logo-transparent-512.webp',
    );

    act(() => vi.advanceTimersByTime(170));
    expect(screen.getByTestId('entry-gate')).toHaveClass('gate-entry--active');

    act(() => vi.advanceTimersByTime(1600));
    expect(screen.queryByTestId('entry-gate')).not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('does not disappear from an incidental mobile touch or wheel', () => {
    vi.useFakeTimers();
    render(<EntryGate duration={1600} reducedMotion={false} />);
    fireEvent.touchStart(window);
    fireEvent.pointerDown(window);
    fireEvent.wheel(window);
    expect(screen.getByTestId('entry-gate')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('plays again after a remount instead of skipping the session', () => {
    vi.useFakeTimers();
    const first = render(<EntryGate duration={1600} reducedMotion={false} />);
    first.unmount();
    render(<EntryGate duration={1600} reducedMotion={false} />);
    expect(screen.getByTestId('entry-gate')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('slides the doors behind the wall and pier using compositor-safe properties', () => {
    const css = readFileSync('src/components/motion/EntryGate.css', 'utf8');

    expect(css).not.toMatch(/filter:\s*drop-shadow/);
    expect(css).not.toMatch(/repeating-conic-gradient/);
    expect(css.match(/\.gate-entry__leaf \{([^}]*)\}/)?.[1]).not.toContain('animation');
    expect(css.match(/\.gate-entry__arch-half \{([^}]*)\}/)?.[1]).not.toContain('animation');
    expect(css).toMatch(/\.gate-entry__leaf \{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.gate-entry__wall \{[^}]*z-index:\s*3/);
    expect(css).toMatch(/\.gate-entry__door \{[^}]*z-index:\s*1/);
    expect(css).toMatch(/\.gate-entry__pier \{[^}]*z-index:\s*4/);
    expect(css).toMatch(/\.gate-entry__leaf--left \.gate-entry__door[^}]*animation-name:\s*gate-door-slide-left/);
    expect(css).toContain('@keyframes gate-door-slide-left');
    expect(css).toContain('translate3d(-100%,0,0)');
    expect(css).toContain('@keyframes gate-door-slide-right');
    expect(css).toContain('translate3d(100%,0,0)');
    expect(css).toMatch(/@keyframes gate-camera/);
    expect(css).toMatch(/\.gate-entry__leaf--left \.gate-entry__wall[^}]*right:\s*var\(--door-half-width\)/);

  });

  it('skips and remains unmounted for reduced motion', () => {
    const onComplete = vi.fn();
    render(<EntryGate reducedMotion onComplete={onComplete} />);
    expect(screen.queryByTestId('entry-gate')).not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
