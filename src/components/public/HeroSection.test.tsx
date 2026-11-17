import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HeroSection } from './HeroSection';

vi.mock('../../features/hero/HeroExperience', () => ({
  default: () => null,
}));

describe('HeroSection', () => {
  it('shows 2009 as the founding year', () => {
    render(<HeroSection />);

    expect(screen.getByText('Est. 2009')).toBeInTheDocument();
    expect(screen.queryByText('Est. 2012')).not.toBeInTheDocument();
  });
});
