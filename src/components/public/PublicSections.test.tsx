import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { CompetitionExplorer } from './CompetitionExplorer';
import { FAQSection } from './FAQSection';
import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('exposes a labelled mobile navigation toggle and closes after navigation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole('button', { name: /buka navigasi/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: /navigasi utama/i })).toHaveAttribute(
      'data-open',
      'true',
    );

    await user.click(screen.getByRole('link', { name: /perlombaan/i }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('CompetitionExplorer', () => {
  it('renders six ordered competition entries with discoverable detail links', () => {
    render(
      <MemoryRouter>
        <CompetitionExplorer />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /enam arena/i })).toBeInTheDocument();
    expect(screen.getAllByTestId('competition-entry')).toHaveLength(6);
    expect(screen.getByRole('link', { name: /jelajahi donatopia/i })).toHaveAttribute(
      'href',
      '/perlombaan/donatopia-transporter',
    );
    expect(screen.getAllByText('Draf kategori JRC XIII')).toHaveLength(6);
  });
});

describe('FAQSection', () => {
  it('uses native disclosure controls', () => {
    render(<FAQSection />);

    expect(screen.getByText(/kapan pendaftaran dibuka/i).closest('details')).toBeInTheDocument();
    expect(screen.getAllByText('Akan diumumkan').length).toBeGreaterThan(0);
  });
});
