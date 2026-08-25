import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LegacyWorld } from './LegacyWorld';

describe('LegacyWorld', () => {
  it('keeps the journey, civic, and collaboration narrative in order', () => {
    const { container } = render(<LegacyWorld />);
    const world = container.querySelector('.legacy-world');
    const headings = Array.from(world?.querySelectorAll('h2, h3, h4') ?? []).map((node) => node.textContent);

    expect(world).toHaveAttribute('aria-label', 'Perjalanan, festival, dan kolaborasi JRC');
    expect(headings.indexOf('Empat belas babak membentuk satu warisan.')).toBeLessThan(
      headings.indexOf('Lebih dari pertandingan.'),
    );
    expect(headings.indexOf('Lebih dari pertandingan.')).toBeLessThan(
      headings.indexOf('Arena besar dibangun bersama.'),
    );
  });

  it('omits superseded serial ornaments from the editorial story', () => {
    const { container } = render(<LegacyWorld />);

    expect(container.querySelector('.history-procession__mark')).not.toBeInTheDocument();
    expect(container.querySelector('.history-procession__inscription small')).not.toBeInTheDocument();
    expect(container.querySelector('.civic-assembly__pillars > li > span')).not.toBeInTheDocument();
    expect(container.querySelector('.patron-court__bay > span')).not.toBeInTheDocument();
    expect(container.querySelector('.patron-court__bay > i')).not.toBeInTheDocument();
  });
});
