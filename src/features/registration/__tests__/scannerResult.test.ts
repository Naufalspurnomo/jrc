import { describe, expect, it } from 'vitest';

import { getScannerResultPresentation } from '../scanner';

describe('scanner result mapping', () => {
  it.each([
    ['VALID', 'Valid', 'success'],
    ['ALREADY_CHECKED_IN', 'Sudah check-in', 'warning'],
    ['REVOKED', 'Tiket dicabut', 'danger'],
    ['UNKNOWN', 'Tiket tidak dikenal', 'danger'],
    ['NOT_PAID', 'Belum lunas', 'warning'],
    ['WRONG_EVENT', 'Acara tidak sesuai', 'danger'],
  ] as const)('maps %s to a clear operator state', (result, label, tone) => {
    expect(getScannerResultPresentation(result)).toMatchObject({ label, tone });
  });
});