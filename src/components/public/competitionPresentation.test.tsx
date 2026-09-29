import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CompetitionPage from '../../pages/CompetitionPage';
import { FAQSection } from './FAQSection';
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

    expect(screen.getByRole('heading', { name: 'Castra Guardian' })).toBeInTheDocument();
    expect(screen.getByText('Transporter')).toBeInTheDocument();
    expect(screen.getByText('Rp 250.000 per tim')).toBeInTheDocument();
    expect(screen.getByText('Naya')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0878-4132-4886' })).toHaveAttribute('href', 'tel:087841324886');
    expect(screen.getByAltText('Lambang CASTRA')).toHaveAttribute(
      'src',
      '/assets/arena-emblems/castra-guardian.webp',
    );

    await user.click(screen.getByRole('button', { name: 'Lihat divisi' }));

    const dialog = screen.getByRole('dialog', { name: 'Castra Guardian' });
    expect(dialog).toHaveTextContent('CASTRA');
    expect(dialog).toHaveTextContent('Castra Guardian');
    expect(dialog).toHaveTextContent('Rp 250.000 per tim');
    expect(within(dialog).getByText('Naya')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: '0878-4132-4886' })).toHaveAttribute('href', 'tel:087841324886');
    expect(within(dialog).getByAltText('Lambang CASTRA')).toHaveAttribute(
      'src',
      '/assets/arena-emblems/castra-guardian.webp',
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

    expect(screen.getByRole('heading', { level: 1, name: 'Colosseum Clash' })).toBeInTheDocument();
    expect(screen.getByText('Sumo')).toBeInTheDocument();
    expect(screen.getByText('Rp 250.000 per tim')).toBeInTheDocument();
    expect(screen.getByText('Nadjwa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0888-5454-111' })).toHaveAttribute('href', 'tel:08885454111');
    expect(screen.getByAltText('Lambang COLOSSEUM')).toHaveAttribute(
      'src',
      '/assets/arena-emblems/colosseum-clash.webp',
    );
  });

  it('exposes each guidebook as an accessible external action', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ShowcaseHero />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Lihat divisi' }));
    expect(within(screen.getByRole('dialog', { name: 'Castra Guardian' })).getByRole('link', { name: 'Buka guidebook' })).toHaveAttribute(
      'href',
      'https://drive.google.com/drive/folders/1ga6EzB4Fs7FbC56KvpoAc2xyp9IRjjEP?usp=drive_link',
    );
  });

  it('shows the updated SMA discipline, jargon, description, and guidebook', () => {
    render(
      <MemoryRouter initialEntries={['/perlombaan/pirate-clash-transporter-shooter']}>
        <Routes>
          <Route path="/perlombaan/:slug" element={<CompetitionPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Transporter Line Follower')).toBeInTheDocument();
    expect(screen.getByText('Angkut · Oper · Bangun')).toBeInTheDocument();
    expect(screen.getByText(/Terdapat dua robot, yaitu Robot Transporter dan Line Follower Transporter/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka guidebook' })).toHaveAttribute(
      'href',
      'https://drive.google.com/drive/folders/16BcdtUUSv1JQzueG_RLt0G_fX7SDFu1t?usp=drive_link',
    );
  });

  it('renders every FAQ category contact as its own semantic row', async () => {
    const user = userEvent.setup();
    render(<FAQSection />);

    await user.click(screen.getByRole('button', { name: 'Bagaimana menghubungi panitia?' }));
    const region = screen.getByRole('region', { name: 'Bagaimana menghubungi panitia?' });
    const rows = within(region).getAllByRole('listitem');

    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent('Castra Guardian');
    expect(within(rows[0]).getByText('Naya')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: '0878-4132-4886' })).toHaveAttribute('href', 'tel:087841324886');
    expect(rows[5]).toHaveTextContent('Harpastum Arena');
  });

  it('renders the six guidebook folders as responsive external actions', async () => {
    const user = userEvent.setup();
    render(<FAQSection />);

    await user.click(screen.getByRole('button', { name: 'Di mana guidebook dapat diunduh?' }));
    const region = screen.getByRole('region', { name: 'Di mana guidebook dapat diunduh?' });
    const list = within(region).getByRole('list', { name: 'Guidebook enam arena' });
    const links = within(list).getAllByRole('link', { name: /Buka guidebook/ });

    expect(links).toHaveLength(6);
    expect(links[0]).toHaveAttribute(
      'href',
      'https://drive.google.com/drive/folders/1ga6EzB4Fs7FbC56KvpoAc2xyp9IRjjEP?usp=drive_link',
    );
    expect(links[5]).toHaveAttribute(
      'href',
      'https://drive.google.com/drive/folders/1WhtUwkVA6A00Lvykjly-30VBb6uAwT0e?usp=drive_link',
    );
  });
});