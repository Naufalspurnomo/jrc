import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CompetitionPage from '../../pages/CompetitionPage';
import { ShowcaseHero } from './ShowcaseHero';

vi.mock('../../hooks/useScrollReveal', () => ({
  useScrollReveal: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('arena presentation', () => {
  it('uses the branded arena name and emblem while retaining the official category', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ShowcaseHero />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'CASTRA' })).toBeInTheDocument();
    expect(screen.getByText('Transporter')).toBeInTheDocument();
    expect(screen.getByText('Rp 250.000 per tim · Naya · 0878-4132-4886')).toBeInTheDocument();
    expect(screen.getByAltText('Lambang CASTRA')).toHaveAttribute(
      'src',
      '/assets/arena-emblems/aquaduct-romana.webp',
    );

    await user.click(screen.getByRole('button', { name: 'Lihat divisi' }));

    const dialog = screen.getByRole('dialog', { name: /CASTRA/ });
    expect(dialog).toHaveTextContent('CASTRA');
    expect(dialog).toHaveTextContent('Castra — Transporter');
    expect(dialog).toHaveTextContent('Rp 250.000 per tim');
    expect(dialog).toHaveTextContent('Naya · 0878-4132-4886');
    expect(within(dialog).getByAltText('Lambang CASTRA')).toHaveAttribute(
      'src',
      '/assets/arena-emblems/aquaduct-romana.webp',
    );
  });

  it('shows the branded arena identity on the public competition page', () => {
    render(
      <MemoryRouter initialEntries={['/perlombaan/ring-rumble-sumo']}>
        <Routes>
          <Route path="/perlombaan/:slug" element={<CompetitionPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'COLOSSEUM' })).toBeInTheDocument();
    expect(screen.getByText('Sumo')).toBeInTheDocument();
    expect(screen.getByText('Rp 250.000 per tim')).toBeInTheDocument();
    expect(screen.getByText('Nadjwa · 0888-5454-111')).toBeInTheDocument();
    expect(screen.getByAltText('Lambang COLOSSEUM')).toHaveAttribute(
      'src',
      '/assets/arena-emblems/colosseum-clash.webp',
    );
  });
});