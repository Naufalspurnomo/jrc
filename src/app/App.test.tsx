import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { AppRoutes } from './App';

let robotsMeta: HTMLMetaElement;

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  window.scrollTo = vi.fn();
  document.title = 'Initial title';
  robotsMeta = document.createElement('meta');
  robotsMeta.name = 'robots';
  robotsMeta.content = 'initial';
  document.head.append(robotsMeta);
});

afterEach(() => {
  robotsMeta.remove();
});

function renderRoute(pathname: string) {
  window.history.replaceState({}, '', pathname);
  return render(<App />);
}

async function expectMetadata(title: string, robots: string) {
  await waitFor(() => {
    expect(document.title).toBe(title);
    expect(robotsMeta).toHaveAttribute('content', robots);
  });
}

describe('AppRoutes', () => {
  it('renders the public Roman arena experience at the root route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /java robot contest xiv/i })).toBeInTheDocument();
  });

  it('renders the participant login route', async () => {
    render(
      <MemoryRouter initialEntries={['/portal/masuk']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /portal peserta/i })).toBeInTheDocument();
  });

  it('renders the not-found route', () => {
    render(
      <MemoryRouter initialEntries={['/rute-tidak-ada']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /halaman tidak ditemukan/i })).toBeInTheDocument();
  });
});

describe('route scroll behavior', () => {
  it('does not repeatedly force the root route back to the top after manual scrolling', async () => {
    renderRoute('/');
    await new Promise((resolve) => window.setTimeout(resolve, 120));

    vi.mocked(window.scrollTo).mockClear();
    await new Promise((resolve) => window.setTimeout(resolve, 900));

    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});

describe('entry gate lifecycle', () => {
  it('only appears for a document initially loaded at the root route', async () => {
    renderRoute('/');
    expect(screen.getByTestId('entry-gate')).toBeInTheDocument();

    act(() => {
      window.history.pushState({}, '', '/portal/masuk');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByRole('heading', { name: /portal peserta/i })).toBeInTheDocument();
    expect(screen.queryByTestId('entry-gate')).not.toBeInTheDocument();

    act(() => {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByRole('heading', { name: /java robot contest xiv/i })).toBeInTheDocument();
    expect(screen.queryByTestId('entry-gate')).not.toBeInTheDocument();
  });

  it('never appears when the document initially loads a competition route', async () => {
    renderRoute('/perlombaan/ring-rumble-sumo');
    expect(await screen.findByRole('heading', { name: /ring rumble/i })).toBeInTheDocument();
    expect(screen.queryByTestId('entry-gate')).not.toBeInTheDocument();
  });
});

describe('route metadata', () => {
  it('indexes the home page with its event title', async () => {
    renderRoute('/');

    expect(screen.getByRole('heading', { name: /java robot contest xiv/i })).toBeInTheDocument();
    await expectMetadata(
      'JRC XIV — Imperium Machina',
      'index,follow,max-image-preview:large',
    );
  });

  it('indexes a known competition with its short name in the title', async () => {
    renderRoute('/perlombaan/ring-rumble-sumo');

    expect(await screen.findByRole('heading', { name: /ring rumble/i })).toBeInTheDocument();
    await expectMetadata(
      'Ring Rumble — Perlombaan JRC XIV',
      'index,follow,max-image-preview:large',
    );
  });

  it('does not index the demo participant portal', async () => {
    renderRoute('/portal/masuk');

    expect(await screen.findByRole('heading', { name: /portal peserta/i })).toBeInTheDocument();
    await expectMetadata('Portal Peserta Demo — JRC XIV', 'noindex,nofollow');
  });

  it('does not index the demo admin', async () => {
    renderRoute('/admin');

    expect(await screen.findByRole('heading', { name: /meja panitia menanti/i })).toBeInTheDocument();
    await expectMetadata('Admin Demo — JRC XIV', 'noindex,nofollow');
  });

  it('does not index an unknown route', async () => {
    renderRoute('/rute-tidak-ada');

    expect(screen.getByRole('heading', { name: /halaman tidak ditemukan/i })).toBeInTheDocument();
    await expectMetadata('Halaman Tidak Ditemukan — JRC XIV', 'noindex,nofollow');
  });

  it('treats an unknown competition as not found', async () => {
    renderRoute('/perlombaan/tidak-ada');

    expect(await screen.findByRole('heading', { name: /arena tidak ditemukan/i })).toBeInTheDocument();
    await expectMetadata('Halaman Tidak Ditemukan — JRC XIV', 'noindex,nofollow');
  });
});
