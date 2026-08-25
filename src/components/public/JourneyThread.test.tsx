import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JourneyThread } from './JourneyThread';

describe('JourneyThread', () => {
  it('renders an inert guide and a separately fillable progress route', () => {
    const { container } = render(
      <div className="lower-world">
        <h2 data-journey-anchor data-journey-side="right">Pembuka</h2>
        <h3 data-journey-anchor data-journey-side="left">Bab berikutnya</h3>
        <JourneyThread />
      </div>,
    );

    const route = container.querySelector('.journey-thread');
    const guide = container.querySelector('.journey-thread__guide');
    const progress = container.querySelector('.journey-thread__progress');

    expect(route).toHaveAttribute('aria-hidden', 'true');
    expect(route).toHaveAttribute('focusable', 'false');
    expect(guide).toHaveAttribute('pathLength', '1');
    expect(progress).toHaveAttribute('pathLength', '1');
    expect(guide).toHaveAttribute('d');
    expect(progress).toHaveAttribute('d');
  });
});
