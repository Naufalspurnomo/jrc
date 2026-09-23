import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AdminShell } from '../../components/portal/AdminShell';
import {
  registrationApi,
  type CompetitionRecord,
  type RegistrationApi,
  type TicketRequest,
  type TicketVerification,
} from '../../features/registration/api';
import { getScannerResultPresentation } from '../../features/registration/scanner';

interface AdminScannerPageProps { api?: RegistrationApi }
type GateMember = { name: string; studentId?: string | null };
type CheckInOperator = string | { displayName?: string; name?: string } | null;
type GateVerification = TicketVerification & {
  members?: GateMember[];
  checkedInAt?: string | null;
  checkedInBy?: CheckInOperator;
  operator?: CheckInOperator;
  checkedInByName?: string | null;
};
type ParsedScan = { token: string; eventId: string };

function parseScan(value: string): ParsedScan | null {
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(text, window.location.origin);
    const token = url.searchParams.get('token')?.trim();
    if (token) return { token, eventId: url.searchParams.get('eventId')?.trim() ?? '' };
  } catch { /* Opaque tokens remain valid manual input. */ }
  return { token: text, eventId: '' };
}

function stopVideoTracks(video: HTMLVideoElement | null): void {
  const stream = video?.srcObject;
  if (stream && 'getTracks' in stream && typeof stream.getTracks === 'function') {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (video) video.srcObject = null;
}

function operatorName(value: CheckInOperator | undefined): string {
  if (typeof value === 'string') return value;
  return value?.displayName ?? value?.name ?? '';
}

export default function AdminScannerPage({ api = registrationApi }: AdminScannerPageProps) {
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [eventId, setEventId] = useState('');
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventError, setEventError] = useState('');
  const [qrValue, setQrValue] = useState('');
  const [verification, setVerification] = useState<GateVerification | null>(null);
  const [inspectedRequest, setInspectedRequest] = useState<TicketRequest | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const cameraSessionRef = useRef(0);
  const decodeLockedRef = useRef(false);
  const requestLockedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    let active = true;
    setEventsLoading(true);
    api.competitions.list().then((records: CompetitionRecord[]) => {
      if (!active) return;
      const unique = new Map<string, string>();
      records.filter((item) => item.active !== false && item.eventId).forEach((item) => {
        unique.set(item.eventId!, item.eventName?.trim() || item.eventId!);
      });
      const choices = [...unique].map(([id, name]) => ({ id, name }));
      setEvents(choices);
      if (choices.length === 1) setEventId(choices[0].id);
      setEventError(choices.length ? '' : 'Tidak ada acara aktif yang tersedia.');
    }).catch(() => {
      if (active) setEventError('Daftar acara aktif gagal dimuat. Periksa koneksi, lalu coba lagi.');
    }).finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [api]);

  const stopCamera = useCallback(() => {
    cameraSessionRef.current += 1;
    decodeLockedRef.current = true;
    controlsRef.current?.stop();
    controlsRef.current = null;
    stopVideoTracks(videoRef.current);
    if (mountedRef.current) setCameraActive(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const video = videoRef.current;
    return () => {
      mountedRef.current = false;
      cameraSessionRef.current += 1;
      decodeLockedRef.current = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      stopVideoTracks(video);
    };
  }, []);

  const showWrongEvent = useCallback(() => {
    setRequestError('');
    setInspectedRequest(null);
    setVerification({ result: 'WRONG_EVENT' } as GateVerification);
  }, []);

  const resolveRequest = useCallback((value: string): TicketRequest | null => {
    const parsed = parseScan(value);
    if (!parsed) {
      setRequestError('Kode tiket wajib diisi.');
      setVerification(null);
      return null;
    }
    if (parsed.eventId) {
      if (!events.some((event) => event.id === parsed.eventId) || (eventId && parsed.eventId !== eventId)) {
        showWrongEvent();
        return null;
      }
      if (!eventId) setEventId(parsed.eventId);
      return { token: parsed.token, eventId: parsed.eventId };
    }
    if (!eventId) {
      setRequestError('Pilih acara aktif sebelum memeriksa token.');
      setVerification(null);
      return null;
    }
    return { token: parsed.token, eventId };
  }, [eventId, events, showWrongEvent]);

  const inspect = useCallback(async (request: TicketRequest) => {
    if (requestLockedRef.current) return;
    requestLockedRef.current = true;
    setRequesting(true);
    setRequestError('');
    setVerification(null);
    setInspectedRequest(null);
    try {
      const result = await api.gate.inspect(request) as GateVerification;
      if (!mountedRef.current) return;
      setVerification(result);
      setInspectedRequest(result.result === 'VALID' ? request : null);
    } catch {
      if (!mountedRef.current) return;
      setVerification(null);
      setInspectedRequest(null);
      setRequestError('Tiket gagal diperiksa. Periksa koneksi, lalu coba lagi.');
    } finally {
      requestLockedRef.current = false;
      if (mountedRef.current) setRequesting(false);
    }
  }, [api]);

  const inspectValue = useCallback((value: string) => {
    const request = resolveRequest(value);
    if (request) void inspect(request);
  }, [inspect, resolveRequest]);

  const redeem = async () => {
    if (requestLockedRef.current || !inspectedRequest || verification?.result !== 'VALID') return;
    requestLockedRef.current = true;
    setRequesting(true);
    setRequestError('');
    try {
      const result = await api.gate.redeem(inspectedRequest) as GateVerification;
      if (!mountedRef.current) return;
      setVerification(result);
      setInspectedRequest(null);
    } catch {
      if (!mountedRef.current) return;
      setVerification(null);
      setInspectedRequest(null);
      setRequestError('Check-in gagal dikonfirmasi. Tiket belum ditukarkan; periksa koneksi lalu coba lagi.');
    } finally {
      requestLockedRef.current = false;
      if (mountedRef.current) setRequesting(false);
    }
  };

  const startCamera = async () => {
    stopCamera();
    decodeLockedRef.current = false;
    setCameraError('');
    const session = cameraSessionRef.current;
    setCameraActive(true);
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (!result || decodeLockedRef.current || session !== cameraSessionRef.current) return;
        decodeLockedRef.current = true;
        const text = result.getText();
        setQrValue(parseScan(text)?.token ?? text);
        stopCamera();
        inspectValue(text);
      });
      if (!mountedRef.current || session !== cameraSessionRef.current) {
        controls.stop();
        stopVideoTracks(videoRef.current);
        return;
      }
      controlsRef.current = controls;
    } catch {
      if (!mountedRef.current || session !== cameraSessionRef.current) return;
      stopCamera();
      setCameraError('Kamera tidak dapat diakses. Gunakan HTTPS, izinkan akses kamera, lalu coba lagi.');
    }
  };

  const presentation = verification ? getScannerResultPresentation(verification.result) : null;
  const members = Array.isArray(verification?.members) ? verification.members : [];
  const checkedInBy = verification
    ? verification.checkedInByName || operatorName(verification.checkedInBy) || operatorName(verification.operator)
    : '';
  const checkedInAt = useMemo(() => {
    if (!verification?.checkedInAt) return '';
    const date = new Date(verification.checkedInAt);
    return Number.isNaN(date.getTime()) ? verification.checkedInAt : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }, [verification?.checkedInAt]);

  return <AdminShell><main className="admin-main">
    <header className="admin-page-heading"><div><p className="admin-eyebrow">GERBANG ACARA</p><h1>Pemindai tiket</h1></div></header>
    <section className="admin-register" aria-labelledby="scanner-config-title">
      <div className="admin-register__heading"><div><p className="admin-eyebrow">KONFIGURASI</p><h2 id="scanner-config-title">Periksa tiket masuk</h2></div></div>
      <div className="admin-filters">
        <label htmlFor="scanner-event-id">Acara aktif
          <select id="scanner-event-id" value={eventId} disabled={eventsLoading || requesting} onChange={(event) => { setEventId(event.target.value); setVerification(null); setInspectedRequest(null); }}>
            <option value="">{eventsLoading ? 'Memuat acara…' : 'Pilih acara'}</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
        </label>
        <label htmlFor="scanner-qr-value">Kode QR atau token
          <input id="scanner-qr-value" autoComplete="off" value={qrValue} onChange={(event) => setQrValue(event.target.value)} placeholder="Tempel URL verifikasi atau token" />
        </label>
      </div>
      <button className="admin-action" type="button" disabled={requesting || eventsLoading} onClick={() => inspectValue(qrValue)}>{requesting ? 'Memeriksa…' : 'Periksa tiket'}</button>
      <div><video ref={videoRef} muted playsInline aria-label="Pratinjau kamera pemindai" />
        {cameraActive
          ? <button className="admin-action" type="button" onClick={stopCamera}>Matikan kamera</button>
          : <button className="admin-action" type="button" disabled={eventsLoading} onClick={() => void startCamera()}>Aktifkan kamera</button>}
      </div>
      <p role="note">Kamera memerlukan HTTPS dan izin kamera. Pastikan koneksi jaringan tersedia; token tetap dapat dimasukkan manual.</p>
      {eventError && <p className="admin-error" role="alert">{eventError}</p>}
      {cameraError && <p className="admin-error" role="alert">{cameraError}</p>}
      {requestError && <p className="admin-error" role="alert">{requestError}</p>}
    </section>
    {verification && presentation && <section className="admin-detail-section" role="status" aria-live="polite" aria-atomic="true" data-tone={presentation.tone}>
      <div className="admin-detail-section__heading"><span aria-hidden="true">{presentation.tone === 'success' ? '✓' : '!'}</span><h2>{presentation.label}</h2></div>
      <p>{presentation.description}</p>
      <dl className="admin-detail-grid">
        {verification.teamName && <div><dt>Tim</dt><dd>{verification.teamName}</dd></div>}
        {verification.institution && <div><dt>Institusi</dt><dd>{verification.institution}</dd></div>}
        {verification.competitionName && <div><dt>Kompetisi</dt><dd>{verification.competitionName}</dd></div>}
        {verification.registrationNumber && <div><dt>Nomor pendaftaran</dt><dd>{verification.registrationNumber}</dd></div>}
        {verification.eventName && <div><dt>Acara</dt><dd>{verification.eventName}</dd></div>}
        {checkedInAt && <div><dt>Waktu check-in awal</dt><dd>{checkedInAt}</dd></div>}
        {checkedInBy && <div><dt>Petugas check-in awal</dt><dd>{checkedInBy}</dd></div>}
      </dl>
      {members.length > 0 && <div className="admin-member-list" aria-label="Anggota tim">{members.map((member, index) => <article key={`${member.name}-${member.studentId ?? index}`}><strong>{member.name}</strong>{member.studentId && <small>{member.studentId}</small>}</article>)}</div>}
      {verification.result === 'VALID' && inspectedRequest && <button className="admin-action" type="button" disabled={requesting} onClick={() => void redeem()}>{requesting ? 'Mengonfirmasi…' : 'Konfirmasi check-in'}</button>}
    </section>}
  </main></AdminShell>;
}
