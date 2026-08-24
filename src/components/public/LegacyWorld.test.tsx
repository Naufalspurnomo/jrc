import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LegacyWorld } from './LegacyWorld';

describe('LegacyWorld', () => {
  it('keeps Annales, J-Fest, and Societas in narrative order', () => {
    const { container } = render(<LegacyWorld />);
    const world = container.querySelector('[data-legacy-world]');
    const headings = Array.from(world?.querySelectorAll('h2, h3') ?? []).map((node) => node.textContent);

    expect(world).toHaveAttribute('aria-label', 'Annales JRC, J-Fest Conventus, dan Societas');
    expect(headings.indexOf('Empat belas babak. Satu warisan yang terus bergerak.')).toBeLessThan(
      headings.indexOf('Lebih dari pertandingan.'),
    );
    expect(headings.indexOf('Lebih dari pertandingan.')).toBeLessThan(
      headings.indexOf('Mereka yang membantu arena berdiri.'),
    );
  });

  it('keeps decorative continuity layers hidden from assistive technology', () => {
    const { container } = render(<LegacyWorld />);
    const layers = container.querySelectorAll('[data-legacy-decoration]');

    expect(layers.length).toBeGreaterThanOrEqual(8);
    layers.forEach((layer) => expect(layer).toHaveAttribute('aria-hidden', 'true'));
  });
});
