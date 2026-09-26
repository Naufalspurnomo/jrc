import { describe, expect, it } from 'vitest';

import { ApiError } from '../api';
import {
  describeDocumentUploadError,
  formatBytes,
  isAcceptedDocumentType,
} from '../documentErrors';
import { describeGaps, registrationGaps, type RegistrationReadinessInput } from '../readiness';

const complete: RegistrationReadinessInput = {
  emailVerified: true,
  competitionId: 'competition-1',
  teamName: 'Garuda Robotika',
  institution: 'PENS',
  phone: '081234567890',
  leaderName: 'Ari Wijaya',
  leaderStudentId: '5025211001',
  documentCount: 1,
};

describe('registrationGaps', () => {
  it('reports nothing missing for a complete registration', () => {
    expect(registrationGaps(complete)).toEqual([]);
  });

  it('reports every missing requirement with a focusable target', () => {
    const gaps = registrationGaps({
      ...complete,
      emailVerified: false,
      teamName: '   ',
      leaderStudentId: '',
      documentCount: 0,
    });

    expect(gaps.map((gap) => gap.key)).toEqual([
      'teamName',
      'leaderStudentId',
      'documents',
      'emailVerified',
    ]);
    for (const gap of gaps) {
      expect(gap.detail.trim().length).toBeGreaterThan(0);
      expect(gap.targetId.trim().length).toBeGreaterThan(0);
    }
  });

  it('treats whitespace-only values as missing', () => {
    const gaps = registrationGaps({
      ...complete,
      teamName: '  ',
      institution: '\t',
      phone: ' ',
      leaderName: '\n',
    });
    expect(gaps.map((gap) => gap.key)).toEqual([
      'teamName',
      'institution',
      'phone',
      'leaderName',
    ]);
  });
});

describe('describeGaps', () => {
  it('uses natural Indonesian list separators', () => {
    const build = (count: number) => registrationGaps({
      ...complete,
      teamName: count > 0 ? '' : complete.teamName,
      institution: count > 1 ? '' : complete.institution,
      phone: count > 2 ? '' : complete.phone,
    });

    expect(describeGaps(build(1))).toBe('Nama tim');
    expect(describeGaps(build(2))).toBe('Nama tim dan Institusi');
    expect(describeGaps(build(3))).toBe('Nama tim, Institusi, dan Nomor WhatsApp tim');
  });
});

describe('describeDocumentUploadError', () => {
  const file = { name: 'kartu.pdf', size: 11 * 1024 * 1024 };

  it('names the real size limit on 413 instead of a generic failure', () => {
    const message = describeDocumentUploadError(
      new ApiError(413, { message: 'Document exceeds 10485760 bytes' }),
      file,
      10 * 1024 * 1024,
    );
    expect(message).toContain('kartu.pdf');
    expect(message).toContain('10.0 MB');
    expect(message).not.toContain('Silakan coba lagi');
  });

  it('explains a signature mismatch on 400', () => {
    const message = describeDocumentUploadError(
      new ApiError(400, { message: 'Document must be a PNG, JPEG, or PDF with matching file content' }),
      { name: 'fake.pdf', size: 500 },
      10 * 1024 * 1024,
    );
    expect(message).toContain('Ekspor ulang');
  });

  it('falls back to a retry message for unknown failures', () => {
    expect(describeDocumentUploadError(new Error('boom'), file, 10 * 1024 * 1024))
      .toBe('Dokumen gagal diunggah. Silakan coba lagi.');
  });
});

describe('isAcceptedDocumentType', () => {
  it('accepts the MIME type Windows browsers send for .jpg files', () => {
    expect(isAcceptedDocumentType('image/jpg')).toBe(true);
    expect(isAcceptedDocumentType('image/jpeg')).toBe(true);
    expect(isAcceptedDocumentType('application/pdf')).toBe(true);
    expect(isAcceptedDocumentType('image/gif')).toBe(false);
  });
});

describe('formatBytes', () => {
  it('scales the unit to the size', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2_048)).toBe('2 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB');
  });
});
