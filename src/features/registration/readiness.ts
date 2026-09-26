/**
 * Single source of truth for "what is still missing before this registration can
 * be submitted". Both the on-screen checklist and the submit gate read from here,
 * so the two can never disagree about whether the form is complete.
 */

export interface RegistrationReadinessInput {
  emailVerified: boolean;
  competitionId: string;
  teamName: string;
  institution: string;
  phone: string;
  leaderName: string;
  leaderStudentId: string;
  documentCategories?: string[];
  documentCount?: number;
  hasSupervisor?: boolean;
}

export interface RegistrationGap {
  key: string;
  /** Short label shown in the checklist. */
  label: string;
  /** What exactly the participant still has to do. */
  detail: string;
  /** DOM id of the control to focus when the participant taps the gap. */
  targetId: string;
}

export function registrationGaps(input: RegistrationReadinessInput): RegistrationGap[] {
  const gaps: RegistrationGap[] = [];

  if (!input.competitionId) {
    gaps.push({
      key: 'competition',
      label: 'Kompetisi',
      detail: 'Pilih satu arena kompetisi untuk tim Anda.',
      targetId: 'competition-selection-title',
    });
  }

  if (!input.teamName.trim()) {
    gaps.push({
      key: 'teamName',
      label: 'Nama tim',
      detail: 'Nama tim belum diisi.',
      targetId: 'field-team-name',
    });
  }

  if (!input.institution.trim()) {
    gaps.push({
      key: 'institution',
      label: 'Institusi',
      detail: 'Asal sekolah atau kampus belum diisi.',
      targetId: 'field-institution',
    });
  }

  if (!input.phone.trim()) {
    gaps.push({
      key: 'phone',
      label: 'Nomor WhatsApp tim',
      detail: 'Nomor WhatsApp yang bisa dihubungi panitia belum diisi.',
      targetId: 'field-team-phone',
    });
  }

  if (!input.leaderName.trim()) {
    gaps.push({
      key: 'leaderName',
      label: 'Nama ketua tim',
      detail: 'Nama ketua tim belum diisi.',
      targetId: 'field-leader-name',
    });
  }

  if (!input.leaderStudentId.trim()) {
    gaps.push({
      key: 'leaderStudentId',
      label: 'NIS/NIM ketua',
      detail: 'NIS atau NIM ketua tim belum diisi.',
      targetId: 'field-leader-student-id',
    });
  }

  const required = ['RECOMMENDATION_LETTER', 'IDENTITY_CARD', 'REGISTRATION_FORM', 'TEAM_PHOTO', 'TWIBBON_PROOF'];
  const missingDocuments = input.documentCategories
    ? required.some((category) => !input.documentCategories?.includes(category))
    : input.documentCount === 0;
  if (missingDocuments) {
    gaps.push({
      key: 'documents',
      label: 'Dokumen pendukung',
      detail: 'Unggah kelima kategori dokumen wajib.',
      targetId: 'field-document-file',
    });
  }

  if (input.hasSupervisor === false) gaps.push({ key: 'supervisor', label: 'Pembina', detail: 'Data pembina belum diisi.', targetId: 'field-supervisor-name' });

  if (!input.emailVerified) {
    gaps.push({
      key: 'emailVerified',
      label: 'Verifikasi email',
      detail: 'Buka tautan verifikasi yang dikirim ke email Anda.',
      targetId: 'registration-email-verification',
    });
  }

  return gaps;
}

/** Human-readable summary used in the submit failure message. */
export function describeGaps(gaps: RegistrationGap[]): string {
  const labels = gaps.map((gap) => gap.label);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} dan ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, dan ${labels[labels.length - 1]}`;
}
