import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import AdminScannerPage from '../../../pages/admin/AdminScannerPage';
import type { RegistrationApi } from '../api';

const zxingMocks = vi.hoisted(() => ({
  decodeFromVideoDevice: vi.fn(),
}));

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class MockBrowserQRCodeReader {
    decodeFromVideoDevice = zxingMocks.decodeFromVideoDevice;
  },
}));

function createApi(): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue({
        user: {
          id: 'gate-1',
          displayName: 'Petugas Gerbang',
          email: 'gate@example.test',
          role: 'GATE_STAFF',
        },
      }),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    },
    gate: {
      inspect: vi.fn().mockResolvedValue({
        result: 'VALID',
        teamName: 'Garuda Robotika',
        institution: 'PENS',
        competitionName: 'Ring Rumble — Sumo',
        registrationNumber: 'JRC14-2026-0001',
        eventName: 'JRC XIV',
        email: 'private@example.test',
        phone: '081234567890',
        documents: ['private-card.pdf'],
      }),
      redeem: vi.fn().mockResolvedValue({
        result: 'CHECKED_IN',
        teamName: 'Garuda Robotika',
        institution: 'PENS',
        competitionName: 'Ring Rumble — Sumo',
        registrationNumber: 'JRC14-2026-0001',
        eventName: 'JRC XIV',
      }),
    },
  } as unknown as RegistrationApi;
}

function renderPage(api: RegistrationApi) {
  return render(
    <MemoryRouter>
      <AuthProvider api={api}>
        <AdminScannerPage api={api} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminScannerPage', () => {
  beforeEach(() => {
    zxingMocks.decodeFromVideoDevice.mockReset();
  });

  it('inspects manually, shows gate-safe fields, then redeems only after confirmation', async () => {
    const api = createApi();
    const user = userEvent.setup();
    renderPage(api);

    await user.type(screen.getByLabelText('ID acara'), 'jrc-xiv');
    await user.type(screen.getByLabelText('Kode QR atau token'), 'opaque-token');
    await user.click(screen.getByRole('button', { name: 'Periksa tiket' }));

    await waitFor(() => expect(api.gate.inspect).toHaveBeenCalledWith({
      eventId: 'jrc-xiv',
      token: 'opaque-token',
    }));
    expect(await screen.findByText('Valid')).toBeInTheDocument();
    expect(screen.getByText('Garuda Robotika')).toBeInTheDocument();
    expect(screen.getByText('PENS')).toBeInTheDocument();
    expect(screen.getByText('Ring Rumble — Sumo')).toBeInTheDocument();
    expect(screen.getByText('JRC14-2026-0001')).toBeInTheDocument();
    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('081234567890')).not.toBeInTheDocument();
    expect(screen.queryByText('private-card.pdf')).not.toBeInTheDocument();
    expect(api.gate.redeem).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Konfirmasi check-in' }));

    await waitFor(() => expect(api.gate.redeem).toHaveBeenCalledWith({
      eventId: 'jrc-xiv',
      token: 'opaque-token',
    }));
    expect(await screen.findByText('Check-in berhasil')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Konfirmasi check-in' })).not.toBeInTheDocument();
  });

  it('starts the camera only on request and stops controls plus media tracks on unmount', async () => {
    const controlsStop = vi.fn();
    const trackStop = vi.fn();
    zxingMocks.decodeFromVideoDevice.mockImplementation(async (_deviceId: unknown, video: HTMLVideoElement) => {
      Object.defineProperty(video, 'srcObject', {
        configurable: true,
        value: { getTracks: () => [{ stop: trackStop }] },
        writable: true,
      });
      return { stop: controlsStop };
    });
    const user = userEvent.setup();
    const view = renderPage(createApi());

    expect(zxingMocks.decodeFromVideoDevice).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Aktifkan kamera' }));
    await waitFor(() => expect(zxingMocks.decodeFromVideoDevice).toHaveBeenCalledTimes(1));

    view.unmount();

    expect(controlsStop).toHaveBeenCalledTimes(1);
    expect(trackStop).toHaveBeenCalledTimes(1);
  });
});
