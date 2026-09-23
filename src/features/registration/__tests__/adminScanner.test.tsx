import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthProvider';
import AdminScannerPage from '../../../pages/admin/AdminScannerPage';
import type { CompetitionRecord, RegistrationApi, TicketResult } from '../api';

const zxingMocks = vi.hoisted(() => ({ decodeFromVideoDevice: vi.fn() }));
vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class MockBrowserQRCodeReader {
    decodeFromVideoDevice = zxingMocks.decodeFromVideoDevice;
  },
}));

const oneEvent: CompetitionRecord[] = [
  { id: 'competition-1', name: 'Sumo', eventId: 'jrc-xiv', eventName: 'JRC XIV', active: true },
  { id: 'competition-2', name: 'Transporter', eventId: 'jrc-xiv', eventName: 'JRC XIV', active: true },
  { id: 'old', name: 'Old', eventId: 'jrc-xiii', eventName: 'JRC XIII', active: false },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function createApi(competitions: CompetitionRecord[] = oneEvent): RegistrationApi {
  return {
    auth: {
      me: vi.fn().mockResolvedValue({ user: { id: 'gate-1', displayName: 'Petugas', email: 'gate@example.test', role: 'GATE_STAFF' } }),
      login: vi.fn(), register: vi.fn(), logout: vi.fn().mockResolvedValue(undefined),
    },
    competitions: { list: vi.fn().mockResolvedValue(competitions) },
    gate: {
      inspect: vi.fn().mockResolvedValue({
        result: 'VALID', teamName: 'Garuda Robotika', institution: 'PENS',
        competitionName: 'Sumo', registrationNumber: 'JRC14-2026-0001', eventName: 'JRC XIV',
        email: 'private@example.test', documents: ['private.pdf'],
      }),
      redeem: vi.fn().mockResolvedValue({ result: 'CHECKED_IN' }),
    },
  } as unknown as RegistrationApi;
}

function renderPage(api = createApi()) {
  return { api, ...render(<MemoryRouter><AuthProvider api={api}><AdminScannerPage api={api} /></AuthProvider></MemoryRouter>) };
}

async function enterTokenAndInspect(user: ReturnType<typeof userEvent.setup>, token = 'opaque-token') {
  await user.type(screen.getByLabelText('Kode QR atau token'), token);
  await user.click(screen.getByRole('button', { name: 'Periksa tiket' }));
}

describe('AdminScannerPage', () => {
  beforeEach(() => zxingMocks.decodeFromVideoDevice.mockReset());

  it('loads active events and auto-selects the sole unique event without free-text event ID', async () => {
    const { api } = renderPage();
    await waitFor(() => expect(api.competitions.list).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('textbox', { name: 'ID acara' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Acara aktif' })).toHaveValue('jrc-xiv');
    expect(screen.queryByText('JRC XIII')).not.toBeInTheDocument();
  });

  it('requires explicit event selection when multiple active events exist and raw tokens fail closed', async () => {
    const user = userEvent.setup();
    const { api } = renderPage(createApi([
      ...oneEvent,
      { id: 'other', name: 'Line Follower', eventId: 'jrc-xv', eventName: 'JRC XV', active: true },
    ]));
    const select = await screen.findByRole('combobox', { name: 'Acara aktif' });
    expect(select).toHaveValue('');
    await enterTokenAndInspect(user);
    expect(api.gate.inspect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Pilih acara aktif');
    await user.selectOptions(select, 'jrc-xv');
    await user.click(screen.getByRole('button', { name: 'Periksa tiket' }));
    await waitFor(() => expect(api.gate.inspect).toHaveBeenCalledWith({ eventId: 'jrc-xv', token: 'opaque-token' }));
  });

  it('fails closed with WRONG_EVENT when a verification URL conflicts with explicit selection', async () => {
    const user = userEvent.setup();
    const { api } = renderPage(createApi([
      ...oneEvent,
      { id: 'other', name: 'Other', eventId: 'jrc-xv', eventName: 'JRC XV', active: true },
    ]));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Acara aktif' }), 'jrc-xiv');
    await enterTokenAndInspect(user, 'https://tickets.test/verify?token=abc&eventId=jrc-xv');
    expect(api.gate.inspect).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Acara tidak sesuai');
    expect(screen.getByRole('combobox', { name: 'Acara aktif' })).toHaveValue('jrc-xiv');
  });

  it('uses a URL event when no event was selected, but rejects an unknown event', async () => {
    const user = userEvent.setup();
    const { api } = renderPage(createApi([
      ...oneEvent,
      { id: 'other', name: 'Other', eventId: 'jrc-xv', eventName: 'JRC XV', active: true },
    ]));
    await enterTokenAndInspect(user, 'https://tickets.test/verify?token=abc&eventId=jrc-xv');
    await waitFor(() => expect(api.gate.inspect).toHaveBeenCalledWith({ eventId: 'jrc-xv', token: 'abc' }));
    expect(screen.getByRole('combobox', { name: 'Acara aktif' })).toHaveValue('jrc-xv');

    await user.clear(screen.getByLabelText('Kode QR atau token'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Acara aktif' }), '');
    await enterTokenAndInspect(user, 'https://tickets.test/verify?token=xyz&eventId=forged');
    expect(api.gate.inspect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Acara tidak sesuai');
  });

  it('inspects without redeeming, exposes only gate-safe fields, and blocks duplicate confirmation while pending', async () => {
    const user = userEvent.setup();
    const { api } = renderPage();
    const pending = deferred<{ result: TicketResult }>();
    vi.mocked(api.gate.redeem).mockReturnValue(pending.promise);
    await screen.findByRole('combobox', { name: 'Acara aktif' });
    await enterTokenAndInspect(user);
    expect(await screen.findByText('Valid')).toBeInTheDocument();
    expect(screen.getByText('Garuda Robotika')).toBeInTheDocument();
    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('private.pdf')).not.toBeInTheDocument();
    expect(api.gate.redeem).not.toHaveBeenCalled();

    const confirm = screen.getByRole('button', { name: 'Konfirmasi check-in' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(api.gate.redeem).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    await act(async () => pending.resolve({ result: 'CHECKED_IN' }));
    expect(await screen.findByText('Check-in berhasil')).toBeInTheDocument();
  });

  it.each([
    ['UNKNOWN', 'Tiket tidak dikenal'], ['NOT_PAID', 'Belum lunas'], ['WRONG_EVENT', 'Acara tidak sesuai'],
    ['REVOKED', 'Tiket dicabut'], ['VALID', 'Valid'], ['CHECKED_IN', 'Check-in berhasil'],
    ['ALREADY_CHECKED_IN', 'Sudah check-in'],
  ] as const)('surfaces %s distinctly', async (result, label) => {
    const user = userEvent.setup();
    const api = createApi();
    vi.mocked(api.gate.inspect).mockResolvedValue({ result });
    renderPage(api);
    await screen.findByRole('combobox', { name: 'Acara aktif' });
    await enterTokenAndInspect(user);
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it('shows original check-in timestamp and operator metadata', async () => {
    const user = userEvent.setup();
    const api = createApi();
    vi.mocked(api.gate.inspect).mockResolvedValue({
      result: 'ALREADY_CHECKED_IN', checkedInAt: '2026-09-23T18:30:00.000Z', checkedInBy: { displayName: 'Sinta Gate' },
    } as never);
    renderPage(api);
    await screen.findByRole('combobox', { name: 'Acara aktif' });
    await enterTokenAndInspect(user);
    expect(await screen.findByText('Sudah check-in')).toBeInTheDocument();
    expect(screen.getByText('Sinta Gate')).toBeInTheDocument();
    expect(screen.getByText(/23.*2026|2026/)).toBeInTheDocument();
  });

  it('clears prior success on inspect and redeem network errors', async () => {
    const user = userEvent.setup();
    const api = createApi();
    renderPage(api);
    await screen.findByRole('combobox', { name: 'Acara aktif' });
    await enterTokenAndInspect(user);
    expect(await screen.findByText('Valid')).toBeInTheDocument();
    vi.mocked(api.gate.redeem).mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Konfirmasi check-in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tiket belum ditukarkan');
    expect(screen.queryByText('Valid')).not.toBeInTheDocument();
    expect(screen.queryByText('Check-in berhasil')).not.toBeInTheDocument();
  });

  it('reports competition loading failure and scanner readiness hints', async () => {
    const api = createApi();
    vi.mocked(api.competitions.list).mockRejectedValue(new Error('offline'));
    renderPage(api);
    expect(await screen.findByRole('alert')).toHaveTextContent('acara aktif gagal dimuat');
    expect(screen.getByText(/HTTPS/)).toBeInTheDocument();
    expect(screen.getByText(/izin kamera/)).toBeInTheDocument();
    expect(screen.getAllByText(/koneksi/).length).toBeGreaterThan(0);
  });

  it('locks a camera session after the first decode and makes one inspect request', async () => {
    let callback!: (result: { getText(): string } | undefined) => void;
    const controlsStop = vi.fn();
    zxingMocks.decodeFromVideoDevice.mockImplementation(async (_id, _video, cb) => { callback = cb; return { stop: controlsStop }; });
    const user = userEvent.setup();
    const { api } = renderPage();
    await screen.findByRole('combobox', { name: 'Acara aktif' });
    await user.click(screen.getByRole('button', { name: 'Aktifkan kamera' }));
    await waitFor(() => expect(zxingMocks.decodeFromVideoDevice).toHaveBeenCalledTimes(1));
    act(() => {
      callback({ getText: () => 'camera-token' });
      callback({ getText: () => 'camera-token' });
    });
    await waitFor(() => expect(api.gate.inspect).toHaveBeenCalledTimes(1));
    expect(controlsStop).toHaveBeenCalledTimes(1);
  });

  it('stops controls and every media track on manual stop and unmount', async () => {
    const controlsStop = vi.fn();
    const firstTrackStop = vi.fn();
    const secondTrackStop = vi.fn();
    const user = userEvent.setup();
    const view = renderPage();
    const video = screen.getByLabelText('Pratinjau kamera pemindai') as HTMLVideoElement;
    zxingMocks.decodeFromVideoDevice.mockImplementation(async () => {
      Object.defineProperty(video, 'srcObject', { configurable: true, value: { getTracks: () => [{ stop: firstTrackStop }, { stop: secondTrackStop }] }, writable: true });
      return { stop: controlsStop };
    });
    await screen.findByRole('combobox', { name: 'Acara aktif' });
    await user.click(screen.getByRole('button', { name: 'Aktifkan kamera' }));
    await screen.findByRole('button', { name: 'Matikan kamera' });
    await user.click(screen.getByRole('button', { name: 'Matikan kamera' }));
    expect(controlsStop).toHaveBeenCalledTimes(1);
    expect(firstTrackStop).toHaveBeenCalledTimes(1);
    expect(secondTrackStop).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('stops late camera controls and tracks after unmount', async () => {
    const camera = deferred<{ stop(): void }>();
    const controlsStop = vi.fn();
    const trackStop = vi.fn();
    const user = userEvent.setup();
    const view = renderPage();
    const video = screen.getByLabelText('Pratinjau kamera pemindai') as HTMLVideoElement;
    zxingMocks.decodeFromVideoDevice.mockImplementation(async () => {
      Object.defineProperty(video, 'srcObject', { configurable: true, value: { getTracks: () => [{ stop: trackStop }] }, writable: true });
      return camera.promise;
    });
    await screen.findByRole('combobox', { name: 'Acara aktif' });
    await user.click(screen.getByRole('button', { name: 'Aktifkan kamera' }));
    view.unmount();
    await act(async () => camera.resolve({ stop: controlsStop }));
    expect(controlsStop).toHaveBeenCalledTimes(1);
    expect(trackStop).toHaveBeenCalled();
  });
});
