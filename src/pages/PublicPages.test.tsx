import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CompetitionPage from './CompetitionPage';
import HomePage from './HomePage';

vi.mock('../scene/HeroExperience', () => ({
  default: () => <div data-testid="hero-experience" aria-hidden="true" />,
}));

afterEach(cleanup);

describe('HomePage', () => {
  it('provides one page heading and the full public narrative', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/java robot contest/i);
    expect(screen.getByTestId('hero-experience')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /jalan menuju arena/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /empat belas babak/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /masuki arena/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});

describe('CompetitionPage', () => {
  it('renders a known competition with transparent draft information', () => {
    render(
      <MemoryRouter initialEntries={['/perlombaan/ring-rumble-sumo']}>
        <Routes>
          <Route path="/perlombaan/:slug" element={<CompetitionPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ring Rumble');
    expect(screen.getAllByText('Draf kategori JRC XIII')).toHaveLength(2);
    expect(screen.getAllByText('Akan diumumkan').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: /kembali ke enam arena/i })).toHaveAttribute(
      'href',
      '/#perlombaan',
    );
  });

  it('renders an explicit not-found state for an unknown competition', () => {
    render(
      <MemoryRouter initialEntries={['/perlombaan/tidak-ada']}>
        <Routes>
          <Route path="/perlombaan/:slug" element={<CompetitionPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/arena tidak ditemukan/i);
    expect(screen.getByRole('link', { name: /^kembali ke beranda$/i })).toHaveAttribute('href', '/');
  });
});
