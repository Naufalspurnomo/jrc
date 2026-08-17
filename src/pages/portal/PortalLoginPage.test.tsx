import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LocalPortalRepository } from '../../data/portal';
import PortalLoginPage from './PortalLoginPage';

const createTestStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value),
  };
};

describe('PortalLoginPage', () => {
  it('starts a participant demo session and opens the dashboard', async () => {
    const repository = new LocalPortalRepository(createTestStorage());
    render(
      <MemoryRouter initialEntries={['/portal/masuk']}>
        <Routes>
          <Route path="/portal/masuk" element={<PortalLoginPage repository={repository} />} />
          <Route path="/portal" element={<h1>Dashboard peserta</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /masuk sebagai peserta/i }));

    expect(screen.getByRole('heading', { name: 'Dashboard peserta' })).toBeInTheDocument();
    expect(repository.getSession()).toMatchObject({ role: 'participant', registrationId: 'reg-aurora' });
  });
});
