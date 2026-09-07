import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AdminShell } from '../../components/portal/AdminShell';
import {
  registrationApi,
  type RegistrationApi,
  type TicketRequest,
  type TicketVerification,
} from '../../features/registration/api';
import { getScannerResultPresentation } from '../../features/registration/scanner';

interface AdminScannerPageProps {
  api?: RegistrationApi;
}

type GateMember = {
  name: string;
  studentId?: string | null;
};

type GateVerification = TicketVerification & {
  members?: GateMember[];
};

function readQrValue(value: string, fallbackEventId: string): TicketRequest | null {
  const text = value.trim();
  if (!text) return null;

  try {
    const url = new URL(text, window.location.origin);
    const token = url.searchParams.get('token')?.trim();
    if (token) {
      return {
        token,
        eventId: url.searchParams.get('eventId')?.trim() || fallbackEventId.trim(),
      };
    }
  } catch {
    // Non-URL values are treated as opaque ticket tokens.
  }

  return { token: text, eventId: fallbackEventId.trim() };
}

function stopVideoTracks(video: HTMLVideoElement | null): void {
  const stream = video?.srcObject;
  if (stream && 'getTracks' in stream && typeof stream.getTracks === 'function') {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (video) video.srcObject = null;
}

export default function AdminScannerPage({ api = registrationApi }: AdminScannerPageProps) {
  const [eventId, setEventId] = useState('');
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

  const stopCamera = useCallback(() => {
    cameraSessionRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    stopVideoTracks(videoRef.current);
    setCameraActive(false);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      stopCamera();
      stopVideoTracks(video);
    };
  }, [stopCamera]);

  const inspect = useCallback(async (request: TicketRequest) => {
    if (!request.token || !request.eventId) {
      setRequestError('ID acara dan kode tiket wajib diisi.');
      setVerification(null);
      setInspectedRequest(null);
      return;
    }

    setRequesting(true);
    setRequestError('');
    setVerification(null);
    setInspectedRequest(null);
    try {
      const result = await api.gate.inspect(request) as GateVerification;
      setVerification(result);
      setInspectedRequest(request);
    } catch {
      setRequestError('Tiket gagal diperiksa. Periksa koneksi, lalu coba lagi.');
    } finally {
      setRequesting(false);
    }
  }, [api]);

  const inspectManualValue = () => {
    const request = readQrValue(qrValue, eventId);
    if (!request) {
      setRequestError('ID acara dan kode tiket wajib diisi.');
      return;
    }
    if (request.eventId !== eventId) setEventId(request.eventId);
    void inspect(request);
  };

  const redeem = async () => {
    if (!inspectedRequest || verification?.result !== 'VALID') return;

    setRequesting(true);
    setRequestError('');
    try {
      const result = await api.gate.redeem(inspectedRequest) as GateVerification;
      setVerification(result);
      setInspectedRequest(null);
    } catch {
      setRequestError('Check-in gagal dikonfirmasi. Tiket belum ditukarkan; silakan coba lagi.');
    } finally {
      setRequesting(false);
    }
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError('');
    const session = cameraSessionRef.current;
    setCameraActive(true);

    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (!result || session !== cameraSessionRef.current) return;
        const request = readQrValue(result.getText(), eventId);
        stopCamera();
        if (!request?.eventId) {
          setCameraError('QR terbaca, tetapi ID acara tidak tersedia. Isi ID acara lalu coba lagi.');
          return;
        }
        setQrValue(request.token);
        setEventId(request.eventId);
        void inspect(request);
      });

      if (session !== cameraSessionRef.current) {
        controls.stop();
        stopVideoTracks(videoRef.current);
        return;
      }
      controlsRef.current = controls;
    } catch {
      if (session !== cameraSessionRef.current) return;
      stopCamera();
      setCameraError('Kamera tidak dapat diakses. Izinkan akses kamera, lalu coba lagi.');
    }
  };

  const presentation = verification ? getScannerResultPresentation(verification.result) : null;
  const members = Array.isArray(verification?.members) ? verification.members : [];

  return (
    <AdminShell>
      <main className="admin-main">
        <header className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">GERBANG ACARA</p>
            <h1>Pemindai tiket</h1>
          </div>
        </header>

        <section className="admin-register" aria-labelledby="scanner-config-title">
          <div className="admin-register__heading">
            <div>
              <p className="admin-eyebrow">KONFIGURASI</p>
              <h2 id="scanner-config-title">Periksa tiket masuk</h2>
            </div>
          </div>

          <div className="admin-filters">
            <label htmlFor="scanner-event-id">
              ID acara
              <input
                id="scanner-event-id"
                autoComplete="off"
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
                placeholder="contoh: jrc-xiv"
              />
            </label>
            <label htmlFor="scanner-qr-value">
              Kode QR atau token
              <input
                id="scanner-qr-value"
                autoComplete="off"
                value={qrValue}
                onChange={(event) => setQrValue(event.target.value)}
                placeholder="Tempel URL verifikasi atau token"
              />
            </label>
          </div>

          <button
            className="admin-action"
            type="button"
            disabled={requesting}
            onClick={inspectManualValue}
          >
            {requesting ? 'Memeriksa…' : 'Periksa tiket'}
          </button>

          <div>
            <video ref={videoRef} muted playsInline aria-label="Pratinjau kamera pemindai" />
            {cameraActive ? (
              <button className="admin-action" type="button" onClick={stopCamera}>Matikan kamera</button>
            ) : (
              <button className="admin-action" type="button" onClick={() => void startCamera()}>Aktifkan kamera</button>
            )}
          </div>
          {cameraError && <p className="admin-error" role="alert">{cameraError}</p>}
          {requestError && <p className="admin-error" role="alert">{requestError}</p>}
        </section>

        {verification && presentation && (
          <section className="admin-detail-section" role="status" aria-live="polite" data-tone={presentation.tone}>
            <div className="admin-detail-section__heading">
              <span aria-hidden="true">✓</span>
              <h2>{presentation.label}</h2>
            </div>
            <p>{presentation.description}</p>
            <dl className="admin-detail-grid">
              {verification.teamName && <div><dt>Tim</dt><dd>{verification.teamName}</dd></div>}
              {verification.institution && <div><dt>Institusi</dt><dd>{verification.institution}</dd></div>}
              {verification.competitionName && <div><dt>Kompetisi</dt><dd>{verification.competitionName}</dd></div>}
              {verification.registrationNumber && (
                <div><dt>Nomor pendaftaran</dt><dd>{verification.registrationNumber}</dd></div>
              )}
              {verification.eventName && <div><dt>Acara</dt><dd>{verification.eventName}</dd></div>}
            </dl>
            {members.length > 0 && (
              <div className="admin-member-list" aria-label="Anggota tim">
                {members.map((member, index) => (
                  <article key={`${member.name}-${member.studentId ?? index}`}>
                    <strong>{member.name}</strong>
                    {member.studentId && <small>{member.studentId}</small>}
                  </article>
                ))}
              </div>
            )}
            {verification.result === 'VALID' && inspectedRequest && (
              <button className="admin-action" type="button" disabled={requesting} onClick={() => void redeem()}>
                {requesting ? 'Mengonfirmasi…' : 'Konfirmasi check-in'}
              </button>
            )}
          </section>
        )}
      </main>
    </AdminShell>
  );
}
