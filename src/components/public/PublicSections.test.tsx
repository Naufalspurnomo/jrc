import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { eventFacts } from '../../content/jrc';
import { EventFacts } from './EventFacts';
import { FAQSection } from './FAQSection';
import { ShowcaseHero } from './ShowcaseHero';
import { SiteHeader } from './SiteHeader';

const getFact = (label: string) => {
  const term = screen.getByText(label);
  const group = term.closest('div');

  expect(term.tagName).toBe('DT');
  expect(group?.querySelector('dd')).toBeInTheDocument();

  return group;
};

describe('EventFacts', () => {
  it('renders the factual information register without duplicating the hero countdown', () => {
    render(<EventFacts />);

    expect(screen.getByRole('heading', { name: 'Informasi JRC XIV' })).toBeInTheDocument();
    expect(
      screen.getByText(/Java Robot Contest merupakan acara tahunan yang diadakan/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByText('Pendaftaran ditutup dalam')).not.toBeInTheDocument();
    expect(document.querySelector('.event-brief__details')).toHaveAttribute(
      'aria-label',
      'Informasi utama JRC',
    );

    expect(getFact('Periode pendaftaran')).toHaveTextContent(eventFacts.registration);
    expect(getFact('Hari pertandingan')).toHaveTextContent(eventFacts.eventDate);
    expect(getFact('Lokasi')).toHaveTextContent('PENS, Surabaya');
  });

  it('omits the superseded signal-sheet headline and arena ornaments', () => {
    render(<EventFacts />);

    expect(screen.queryByText('JRC edisi 14.')).not.toBeInTheDocument();
    expect(screen.queryByText('Pendaftaran dan hari pertandingan')).not.toBeInTheDocument();
    expect(document.querySelector('.arena-facts__architecture-axis')).not.toBeInTheDocument();
    expect(document.querySelector('.arena-facts__signal-line')).not.toBeInTheDocument();
  });
});


describe('SiteHeader', () => {
  it('exposes the ceremonial mobile menu and closes after navigation', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SiteHeader /></MemoryRouter>);

    const toggle = screen.getByRole('button', { name: /buka navigasi/i });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: /navigasi utama/i })).toHaveAttribute('data-open', 'true');
    expect(screen.getByRole('navigation').querySelector('.site-header__nav-portal')).toHaveAttribute('href', '/portal/masuk');

    await user.click(screen.getByRole('link', { name: /perlombaan/i }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('locks body styles, traps focus, closes on Escape, and restores focus', async () => {
    const user = userEvent.setup();
    document.body.style.position = 'relative';
    document.body.style.top = '3px';
    render(<MemoryRouter><SiteHeader /></MemoryRouter>);

    const toggle = screen.getByRole('button', { name: /buka navigasi/i });
    await user.click(toggle);
    const portal = screen.getByRole('navigation').querySelector<HTMLElement>('.site-header__nav-portal')!;

    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.overflow).toBe('hidden');
    portal.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(toggle);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(portal);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(toggle);
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.top).toBe('3px');
    document.body.removeAttribute('style');
  });
});

describe('FAQSection', () => {
  it('renders accordion buttons with aria-expanded', async () => {
    const user = userEvent.setup();
    const { container } = render(<FAQSection />);

    expect(container.querySelector('.journey-scene--faq')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-journey-anchor]')).toHaveLength(2);

    const buttons = screen.getAllByRole('button', { expanded: false });
    expect(buttons.length).toBeGreaterThanOrEqual(5);

    await user.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getAllByText('Akan diumumkan').length).toBeGreaterThan(0);
  });
});

describe('ShowcaseHero', () => {
  it('renders one cinematic character selection with concise division information', () => {
    render(
      <MemoryRouter>
        <ShowcaseHero />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Donatopia' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /donatopia.*transporter/i })).toHaveAttribute(
      'src',
      '/assets/roman-select/athena.webp',
    );
    expect(screen.getByText('Transporter')).toBeInTheDocument();
    expect(screen.getByText(/SD.*Ketentuan JRC XIV belum final/i)).toBeInTheDocument();
    expect(screen.getByText('01/06')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lihat divisi' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(screen.getByRole('button', { name: /divisi sebelumnya/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /divisi berikutnya/i })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent(/Donatopia.*1 dari 6/i);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/sasaran desain/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/berkas arena/i)).not.toBeInTheDocument();
  });

  it('renders labelled portrait previews that navigate and wrap around the selector', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <ShowcaseHero />
      </MemoryRouter>,
    );

    const previousPreview = screen.getByRole('button', {
      name: 'Pilih Goal Rush — pratinjau sebelumnya',
    });
    const nextPreview = screen.getByRole('button', {
      name: 'Pilih Nightmaze — pratinjau berikutnya',
    });

    expect(previousPreview).toHaveTextContent('Goal Rush');
    expect(previousPreview.querySelector('[data-preview-src]')).toHaveAttribute(
      'data-preview-src',
      '/assets/roman-select/hercules.webp',
    );
    expect(nextPreview).toHaveTextContent('Nightmaze');
    expect(nextPreview.querySelector('[data-preview-src]')).toHaveAttribute(
      'data-preview-src',
      '/assets/roman-select/ares.webp',
    );

    await user.click(previousPreview);
    expect(screen.getByRole('heading', { name: 'Goal Rush' })).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'Pilih Donatopia — pratinjau berikutnya',
    })).toBeDisabled();

    fireEvent.animationEnd(container.querySelector('[data-phase="incoming"]') as Element);
    await waitFor(() => {
      expect(screen.getByRole('button', {
        name: 'Pilih Donatopia — pratinjau berikutnya',
      })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', {
      name: 'Pilih Donatopia — pratinjau berikutnya',
    }));
    expect(screen.getByRole('heading', { name: 'Donatopia' })).toBeInTheDocument();
  });

  it('wraps infinitely in both directions and preserves the active detail route', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <ShowcaseHero />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /divisi sebelumnya/i }));
    expect(screen.getByRole('heading', { name: 'Goal Rush' })).toBeInTheDocument();
    expect(screen.getByText('06/06')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lihat divisi' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );

    fireEvent.animationEnd(container.querySelector('[data-phase="incoming"]') as Element);
    await waitFor(() => {
      expect(container.querySelector('[data-transitioning="false"]')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /divisi berikutnya/i }));
    expect(screen.getByRole('heading', { name: 'Donatopia' })).toBeInTheDocument();
    expect(screen.getByText('01/06')).toBeInTheDocument();
  });

  it('opens details in a popup dialog instead of navigating away', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ShowcaseHero />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Lihat divisi' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Donatopia', level: 2 })).toBeInTheDocument();
    // Full page still reachable from inside modal
    expect(screen.getByRole('link', { name: 'Halaman penuh' })).toHaveAttribute(
      'href',
      '/perlombaan/donatopia-transporter',
    );
    await user.click(screen.getByRole('button', { name: 'Tutup detail arena' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('traps focus, locks page scroll, and restores the invoking control', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ShowcaseHero />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Lihat divisi' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Tutup detail arena' });
    const finalAction = screen.getByRole('button', { name: 'Tutup' });

    expect(document.activeElement).toBe(close);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(finalAction);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.position).toBe('');
  });

  it('ignores rapid repeated navigation while a portrait is transitioning', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ShowcaseHero />
      </MemoryRouter>,
    );

    const next = screen.getByRole('button', { name: /divisi berikutnya/i });
    await user.dblClick(next);

    expect(screen.getByRole('heading', { name: 'Nightmaze' })).toBeInTheDocument();
    expect(screen.getByText('02/06')).toBeInTheDocument();
  });

  it('uses arrow keys only while focus is inside or the pointer is over the selector', async () => {
    const { container } = render(
      <MemoryRouter>
        <ShowcaseHero />
      </MemoryRouter>,
    );
    const section = container.querySelector('#perlombaan') as HTMLElement;

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Donatopia' })).toBeInTheDocument();

    fireEvent.pointerEnter(section);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Nightmaze' })).toBeInTheDocument();

    fireEvent.animationEnd(container.querySelector('[data-phase="incoming"]') as Element);
    await waitFor(() => {
      expect(container.querySelector('[data-transitioning="false"]')).toBeInTheDocument();
    });
    fireEvent.pointerLeave(section);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Nightmaze' })).toBeInTheDocument();

    screen.getByRole('button', { name: 'Lihat divisi' }).focus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Lihat divisi' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { name: 'Donatopia' })).toBeInTheDocument();
  });

  it('changes division only when a horizontal swipe reaches 50px', () => {
    const { container } = render(
      <MemoryRouter>
        <ShowcaseHero />
      </MemoryRouter>,
    );
    const stage = container.querySelector('.character-selector__stage') as HTMLElement;

    fireEvent.touchStart(stage, { changedTouches: [{ clientX: 200 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 151 }] });
    expect(screen.getByRole('heading', { name: 'Donatopia' })).toBeInTheDocument();

    fireEvent.touchStart(stage, { changedTouches: [{ clientX: 200 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 150 }] });
    expect(screen.getByRole('heading', { name: 'Nightmaze' })).toBeInTheDocument();
  });
});
