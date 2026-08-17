import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LocalPortalRepository } from '../../data/portal';
import PortalDashboardPage from './PortalDashboardPage';

const storage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (i) => [...values.keys()][i] ?? null,
    removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value),
  };
};

describe('PortalDashboardPage', () => {
  it('shows the current team progress and lets the participant sign out', async () => {
    const repository = new LocalPortalRepository(storage());
    repository.startSession({ role: 'participant', name: 'Aurora', registrationId: 'reg-aurora' });

    render(
      <MemoryRouter initialEntries={['/portal']}>
        <Routes>
          <Route path="/portal" element={<PortalDashboardPage repository={repository} />} />
          <Route path="/portal/masuk" element={<h1>Portal masuk</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /aurora mechanica/i })).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /kelengkapan pendaftaran/i })).toHaveAttribute(
      'aria-valuenow',
      '60',
    );
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /lanjutkan pendaftaran/i })).toHaveAttribute('href', '/portal/pendaftaran');

    await userEvent.click(screen.getByRole('button', { name: /keluar/i }));
    expect(screen.getByRole('heading', { name: 'Portal masuk' })).toBeInTheDocument();
    expect(repository.getSession()).toBeNull();
  });
});
