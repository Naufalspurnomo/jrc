import type { RegistrationStatus } from '../../data/portal';

const labels: Record<RegistrationStatus, string> = {
  draft: 'Draft',
  submitted: 'Terkirim',
  under_review: 'Ditinjau',
  revision_requested: 'Perlu revisi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
};

export function StatusBadge({ status }: { status: RegistrationStatus }) {
  return <span className={`portal-status portal-status--${status}`}>{labels[status]}</span>;
}

export const registrationStatusLabel = (status: RegistrationStatus) => labels[status];
