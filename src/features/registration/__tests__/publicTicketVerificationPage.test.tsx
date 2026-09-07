import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PublicTicketVerificationPage from '../../../pages/ticket/PublicTicketVerificationPage';
import type { RegistrationApi } from '../api';

function createApi(): RegistrationApi {
  return {
    tickets: {
      verify: vi.fn().mockResolvedValue({
        result: 'VALID',
        teamName: 'Garuda Robotika',
        institution: 'PENS',
        competitionName: 'Ring Rumble — Sumo',
        registrationNumber: 'JRC14-2026-0001',
        eventId: 'jrc-xiv',
        eventName: 'JRC XIV',
        email: 'private@example.test',
        phone: '081234567890',
        documents: ['private-card.pdf'],
        payment: { amount: 900_000 },
      }),
    },
  } as unknown as RegistrationApi;
}

describe('PublicTicketVerificationPage', () => {
  it('verifies query parameters and renders only normalized public fields', async () => {
    const api = createApi();
    render(
      <MemoryRouter initialEntries={['/ticket/verify?token=opaque-token&eventId=jrc-xiv']}>
        <PublicTicketVerificationPage api={api} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.tickets.verify).toHaveBeenCalledWith({
      token: 'opaque-token',
      eventId: 'jrc-xiv',
    }));
    expect(await screen.findByText('Garuda Robotika')).toBeInTheDocument();
    expect(screen.getByText('JRC14-2026-0001')).toBeInTheDocument();
    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('081234567890')).not.toBeInTheDocument();
    expect(screen.queryByText('private-card.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('900000')).not.toBeInTheDocument();
  });

  it('removes verification parameters from the browser address bar after capturing them', async () => {
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const originalState = window.history.state;
    const api = createApi();
    const replaceState = vi.spyOn(window.history, 'replaceState');
    let unmount = () => {};

    try {
      window.history.replaceState(
        null,
        '',
        '/ticket/verify?token=address-bar-token&eventId=address-bar-event#verification',
      );
      replaceState.mockClear();

      ({ unmount } = render(
        <BrowserRouter>
          <PublicTicketVerificationPage api={api} />
        </BrowserRouter>,
      ));

      await waitFor(() => expect(api.tickets.verify).toHaveBeenCalledWith({
        token: 'address-bar-token',
        eventId: 'address-bar-event',
      }));
      expect(window.location.pathname).toBe('/ticket/verify');
      expect(window.location.search).toBe('');
      expect(window.location.hash).toBe('#verification');
      expect(replaceState).toHaveBeenLastCalledWith(
        window.history.state,
        '',
        '/ticket/verify#verification',
      );
    } finally {
      unmount();
      replaceState.mockRestore();
      window.history.replaceState(originalState, '', originalUrl);
    }
  });

  it('shows an invalid result without calling the API when token is missing', async () => {
    const api = createApi();
    render(
      <MemoryRouter initialEntries={['/ticket/verify?eventId=jrc-xiv']}>
        <PublicTicketVerificationPage api={api} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Tiket tidak valid');
    expect(api.tickets.verify).not.toHaveBeenCalled();
  });
});
