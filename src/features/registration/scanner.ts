import type { TicketResult } from './api';

export type ScannerTone = 'success' | 'warning' | 'danger';

export interface ScannerResultPresentation {
  label: string;
  description: string;
  tone: ScannerTone;
}

const presentations: Record<TicketResult, ScannerResultPresentation> = {
  VALID: {
    label: 'Valid',
    description: 'Tiket valid untuk acara ini.',
    tone: 'success',
  },
  CHECKED_IN: {
    label: 'Check-in berhasil',
    description: 'Tiket berhasil ditukarkan.',
    tone: 'success',
  },
  ALREADY_CHECKED_IN: {
    label: 'Sudah check-in',
    description: 'Tiket ini sudah pernah ditukarkan.',
    tone: 'warning',
  },
  REVOKED: {
    label: 'Tiket dicabut',
    description: 'Tiket telah dicabut dan tidak dapat digunakan.',
    tone: 'danger',
  },
  UNKNOWN: {
    label: 'Tiket tidak dikenal',
    description: 'Token tiket tidak ditemukan atau tidak sah.',
    tone: 'danger',
  },
  NOT_PAID: {
    label: 'Belum lunas',
    description: 'Pembayaran pendaftaran belum dinyatakan lunas.',
    tone: 'warning',
  },
  WRONG_EVENT: {
    label: 'Acara tidak sesuai',
    description: 'Tiket diterbitkan untuk acara yang berbeda.',
    tone: 'danger',
  },
};

export function getScannerResultPresentation(result: TicketResult): ScannerResultPresentation {
  return presentations[result];
}