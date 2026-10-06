import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PortalForgotPasswordPage from '../../../pages/portal/PortalForgotPasswordPage';
import PortalResetPasswordPage from '../../../pages/portal/PortalResetPasswordPage';
import type { RegistrationApi } from '../api';

function createApi(): RegistrationApi {
  return {
    auth: {
      forgotPassword: vi.fn().mockResolvedValue(undefined),
      resetPassword: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as RegistrationApi;
}

describe('participant password recovery', () => {
  it('submits an email and always shows generic recovery guidance', async () => {
    const api = createApi();
    render(
      <MemoryRouter>
        <PortalForgotPasswordPage api={api} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Email'), ' owner@example.test ');
    await userEvent.click(screen.getByRole('button', { name: 'Kirim tautan reset' }));

    await waitFor(() => expect(api.auth.forgotPassword).toHaveBeenCalledWith('owner@example.test'));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Jika email terdaftar dan memenuhi syarat, tautan reset akan dikirim.',
    );
  });

  it('resets a password from the URL token then returns to login', async () => {
    const api = createApi();
    render(
      <MemoryRouter initialEntries={[`/portal/reset-kata-sandi?token=${'A'.repeat(43)}`]}>
        <Routes>
          <Route path="/portal/reset-kata-sandi" element={<PortalResetPasswordPage api={api} />} />
          <Route path="/portal/masuk" element={<h1>Masuk peserta</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Kata sandi baru'), 'new-password-123');
    await userEvent.type(screen.getByLabelText('Ulangi kata sandi baru'), 'new-password-123');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan kata sandi baru' }));

    await waitFor(() => expect(api.auth.resetPassword).toHaveBeenCalledWith(
      'A'.repeat(43),
      'new-password-123',
    ));
    expect(await screen.findByRole('heading', { name: 'Masuk peserta' })).toBeInTheDocument();
  });

  it('rejects mismatched passwords without calling the API', async () => {
    const api = createApi();
    render(
      <MemoryRouter initialEntries={[`/portal/reset-kata-sandi?token=${'A'.repeat(43)}`]}>
        <PortalResetPasswordPage api={api} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Kata sandi baru'), 'new-password-123');
    await userEvent.type(screen.getByLabelText('Ulangi kata sandi baru'), 'different-password');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan kata sandi baru' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Konfirmasi kata sandi tidak cocok.');
    expect(api.auth.resetPassword).not.toHaveBeenCalled();
  });
});
