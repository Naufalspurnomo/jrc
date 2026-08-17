import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LocalPortalRepository } from '../../data/portal';
import AdminRegistrationDetailPage from './AdminRegistrationDetailPage';

const storage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (i) => [...values.keys()][i] ?? null,
    removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value),
  };
};

describe('AdminRegistrationDetailPage', () => {
  it('moves a submitted team through review to verified with an audit note', async () => {
    const user = userEvent.setup();
    const repository = new LocalPortalRepository(storage());
    repository.startSession({ role: 'admin', name: 'Panitia JRC' });
    render(
      <MemoryRouter initialEntries={['/admin/pendaftaran/reg-victoria']}>
        <Routes>
          <Route path="/admin/pendaftaran/:registrationId" element={<AdminRegistrationDetailPage repository={repository} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Victoria Prime' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Catatan panitia'), 'Mulai pemeriksaan administrasi.');
    await user.click(screen.getByRole('button', { name: 'Mulai review' }));
    expect(screen.getAllByText('Ditinjau').length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText('Catatan panitia'));
    await user.type(screen.getByLabelText('Catatan panitia'), 'Seluruh berkas valid.');
    await user.click(screen.getByRole('button', { name: 'Verifikasi' }));

    expect(screen.getAllByText('Terverifikasi').length).toBeGreaterThan(0);
    expect(repository.getRegistration('reg-victoria')?.reviews.at(-1)?.note).toBe('Seluruh berkas valid.');
  });
});
