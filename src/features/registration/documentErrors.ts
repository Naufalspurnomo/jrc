import { ApiError } from './api';

/**
 * Server responses carry a machine code or an English message. Participants see
 * neither: map the real cause onto an actionable Indonesian sentence. The status
 * and code checks come first because the generic message would hide them.
 */
export function describeDocumentUploadError(
  error: unknown,
  file: { name: string; size: number } | null,
  maxUploadBytes: number,
): string {
  if (error instanceof ApiError) {
    if (error.status === 413) {
      return `Berkas ${file ? `"${file.name}" ` : ''}melebihi batas ${formatBytes(maxUploadBytes)}. Kecilkan berkasnya lalu coba lagi.`;
    }
    if (error.status === 400 && /signature|PNG, JPEG, or PDF/i.test(String(error.message))) {
      return 'Isi berkas tidak cocok dengan formatnya. Ekspor ulang sebagai PDF, JPEG, atau PNG lalu coba lagi.';
    }
    if (error.status === 403) {
      return 'Sesi Anda sudah berakhir. Masuk kembali lalu unggah ulang dokumen.';
    }
    if (error.status === 400 && /not editable|current status/i.test(String(error.message))) {
      return 'Pendaftaran tidak dapat diubah pada status saat ini.';
    }
  }

  if (error instanceof TypeError) {
    return 'Koneksi terputus saat mengunggah. Periksa jaringan lalu coba lagi.';
  }

  return 'Dokumen gagal diunggah. Silakan coba lagi.';
}

export function formatBytes(size: number): string {
  if (size < 1_024) return `${size} B`;
  if (size < 1_048_576) return `${Math.ceil(size / 1_024)} KB`;
  return `${(size / 1_048_576).toFixed(1)} MB`;
}

/** The backend accepts these MIME types; `image/jpg` is what Windows browsers send. */
const ACCEPTED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

export function isAcceptedDocumentType(mimeType: string): boolean {
  return ACCEPTED_DOCUMENT_TYPES.has(mimeType);
}

export const DOCUMENT_ACCEPT_ATTRIBUTE = 'application/pdf,image/jpeg,image/png,image/jpg';
