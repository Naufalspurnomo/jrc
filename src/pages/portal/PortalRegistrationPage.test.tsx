import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LocalPortalRepository } from '../../data/portal';
import PortalRegistrationPage from './PortalRegistrationPage';

const storage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (i) => [...values.keys()][i] ?? null,
    removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value),
  };
};

describe('PortalRegistrationPage', () => {
  it('autosaves a complete five-step registration and submits metadata-only documents', async () => {
    const user = userEvent.setup();
    const repository = new LocalPortalRepository(storage());
    repository.startSession({ role: 'participant', name: 'Aurora', registrationId: 'reg-aurora' });
    render(
      <MemoryRouter initialEntries={['/portal/pendaftaran']}>
        <Routes>
          <Route path="/portal/pendaftaran" element={<PortalRegistrationPage repository={repository} />} />
          <Route path="/portal" element={<h1>Pendaftaran terkirim</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText('Nama tim'));
    await user.type(screen.getByLabelText('Nama tim'), 'Legio Aurora');
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }));

    await user.selectOptions(screen.getByLabelText('Pilih arena'), 'soccer');
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }));

    await user.type(screen.getByLabelText('Nama ketua'), 'Aurelia Prima');
    await user.type(screen.getByLabelText('Email ketua'), 'aurelia@example.com');
    await user.type(screen.getByLabelText('Nomor WhatsApp'), '081234567890');
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }));

    const document = new File(['identitas'], 'kartu-pelajar.pdf', { type: 'application/pdf', lastModified: 14 });
    await user.upload(screen.getByLabelText('Dokumen identitas'), document);
    await user.click(screen.getByRole('button', { name: 'Tinjau pendaftaran' }));

    expect(screen.getByText('kartu-pelajar.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /kirim pendaftaran/i }));

    expect(screen.getByRole('heading', { name: 'Pendaftaran terkirim' })).toBeInTheDocument();
    expect(repository.getRegistration('reg-aurora')).toMatchObject({
      teamName: 'Legio Aurora', competitionId: 'soccer', status: 'submitted',
      documents: [{ name: 'kartu-pelajar.pdf', type: 'application/pdf', lastModified: 14 }],
    });
  }, 15_000);
});
