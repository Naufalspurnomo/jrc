import type { PaymentState } from '../../features/registration/api';

interface PaymentNoticeContent {
  title: string;
  message: string;
}

const content: Record<PaymentState, PaymentNoticeContent> = {
  NOT_CREATED: {
    title: 'Pembayaran belum tersedia',
    message: 'Tagihan akan tersedia setelah pendaftaran disetujui.',
  },
  UNPAID: {
    title: 'Belum lunas',
    message: 'Selesaikan pembayaran, lalu unggah bukti pembayaran.',
  },
  PENDING_VERIFICATION: {
    title: 'Menunggu verifikasi',
    message: 'Bukti pembayaran telah diunggah, tetapi belum dinyatakan lunas.',
  },
  PAID: {
    title: 'Lunas',
    message: 'Pembayaran telah diverifikasi oleh panitia.',
  },
  REJECTED: {
    title: 'Bukti pembayaran ditolak',
    message: 'Periksa alasan penolakan, lalu unggah bukti pembayaran baru.',
  },
  EXPIRED: {
    title: 'Tagihan kedaluwarsa',
    message: 'Hubungi panitia untuk meminta tagihan baru.',
  },
  REFUNDED: {
    title: 'Pembayaran dikembalikan',
    message: 'Dana pembayaran telah dikembalikan.',
  },
};

export function PaymentStatusNotice({ status }: { status: PaymentState }) {
  const notice = content[status];
  return (
    <section role="status" aria-live="polite">
      <strong>{notice.title}</strong>
      <p>{notice.message}</p>
    </section>
  );
}