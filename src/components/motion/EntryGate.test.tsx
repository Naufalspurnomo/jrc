import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import EntryGate, { preloadImages } from './EntryGate';

class SuccessfulImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe('preloadImages', () => {
  it('reports real asset progress and resolves at 100 percent', async () => {
    const progress: number[] = [];

    await preloadImages(
      ['/one.webp', '/two.webp'],
      (value) => progress.push(value),
      SuccessfulImage as unknown as typeof Image,
    );

    expect(progress).toEqual([0.5, 1]);
  });
});

describe('EntryGate', () => {
  it('announces loading, completes, and releases the experience', async () => {
    const onReady = vi.fn();
    render(
      <EntryGate
        assets={['/one.webp']}
        imageConstructor={SuccessfulImage as unknown as typeof Image}
        minDuration={0}
        onReady={onReady}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Mempersiapkan arena');

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(screen.getByTestId('entry-gate')).toHaveAttribute('aria-hidden', 'true');
  });
});
