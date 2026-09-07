import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PortalTicketPage from '../../../pages/portal/PortalTicketPage';
import type { RegistrationApi, RegistrationRecord, TicketRecord } from '../api';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="ticket-qr" data-value={value} />
  ),
}));

const registration: RegistrationRecord = {
  id: 'registration-1',
  registrationNumber: 'JRC14-2026-0001',
  competitionId: 'competition-1',
  competition: {
    id: 'competition-1',
    name: 'Ring Rumble — Sumo',
    eventId: 'jrc-xiv',
    eventName: 'JRC XIV',
  },
  teamName: 'Garuda Robotika',
  institution: 'PENS',
  phone: '081234567890',
  members: [{ id: 'member-1', name: 'Private Member', email: 'private@example.test' }],
  status: 'APPROVED',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

const ticket: TicketRecord = {
  token: 'opaque-token',
  verificationUrl: 'https://jrc.example.test/ticket/verify?token=opaque-token&eventId=jrc-xiv',
  status: 'ACTIVE',
};

function renderPage() {
  const api = {
    registrations: {
      get: vi.fn().mockResolvedValue(registration),
      ticket: vi.fn().mockResolvedValue(ticket),
    },
  } as unknown as RegistrationApi;

  render(
    <MemoryRouter initialEntries={['/portal/pendaftaran/registration-1/tiket']}>
      <Routes>
        <Route
          path="/portal/pendaftaran/:registrationId/tiket"
          element={<PortalTicketPage api={api} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PortalTicketPage', () => {
  it('encodes only the backend verification URL and displays safe ticket fields', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: /tiket garuda robotika/i })).toBeInTheDocument();
    expect(screen.getByTestId('ticket-qr')).toHaveAttribute('data-value', ticket.verificationUrl);
    expect(screen.getByTestId('ticket-qr').getAttribute('data-value')).not.toContain('private@example.test');
    expect(screen.getByTestId('ticket-qr').getAttribute('data-value')).not.toContain('081234567890');
    expect(screen.getByText('JRC14-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Ring Rumble — Sumo')).toBeInTheDocument();
    expect(screen.getByText('JRC XIV')).toBeInTheDocument();
    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('081234567890')).not.toBeInTheDocument();
    expect(screen.queryByText('Private Member')).not.toBeInTheDocument();
  });
});
