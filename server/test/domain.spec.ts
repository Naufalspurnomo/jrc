import { describe, expect, it } from 'vitest';
import {
  assertRegistrationTransition,
  canEditRegistration,
  requiresRegistrationReason,
} from '../src/domain/registration-state';
import { assertPaymentTransition } from '../src/domain/payment-state';
import { escapeCsvCell } from '../src/common/csv';
import { hashTicketToken, newTicketToken } from '../src/common/ticket-token';

describe('registration state machine', () => {
  it('allows the complete submission and review workflow', () => {
    expect(() => assertRegistrationTransition('DRAFT', 'SUBMITTED')).not.toThrow();
    expect(() => assertRegistrationTransition('SUBMITTED', 'UNDER_REVIEW')).not.toThrow();
    expect(() => assertRegistrationTransition('UNDER_REVIEW', 'APPROVED')).not.toThrow();
    expect(() => assertRegistrationTransition('UNDER_REVIEW', 'REVISION_REQUESTED')).not.toThrow();
    expect(() => assertRegistrationTransition('REVISION_REQUESTED', 'SUBMITTED')).not.toThrow();
  });

  it('rejects bypassing review and editing locked states', () => {
    expect(() => assertRegistrationTransition('DRAFT', 'APPROVED')).toThrow('not allowed');
    expect(canEditRegistration('DRAFT')).toBe(true);
    expect(canEditRegistration('REVISION_REQUESTED')).toBe(true);
    expect(canEditRegistration('SUBMITTED')).toBe(false);
  });

  it('requires reasons for revision, rejection, and cancellation', () => {
    expect(requiresRegistrationReason('REVISION_REQUESTED')).toBe(true);
    expect(requiresRegistrationReason('REJECTED')).toBe(true);
    expect(requiresRegistrationReason('CANCELLED')).toBe(true);
    expect(requiresRegistrationReason('APPROVED')).toBe(false);
  });
});

describe('payment state machine', () => {
  it('keeps uploaded proof pending until finance verification', () => {
    expect(() => assertPaymentTransition('UNPAID', 'PENDING_VERIFICATION')).not.toThrow();
    expect(() => assertPaymentTransition('PENDING_VERIFICATION', 'PAID')).not.toThrow();
    expect(() => assertPaymentTransition('UNPAID', 'PAID')).toThrow('not allowed');
  });
});

describe('ticket credentials', () => {
  it('creates at least 256 bits of opaque entropy and stores a deterministic hash', () => {
    const token = newTicketToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(hashTicketToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashTicketToken(token)).toBe(hashTicketToken(token));
    expect(hashTicketToken(newTicketToken())).not.toBe(hashTicketToken(token));
  });
});

describe('CSV export safety', () => {
  it.each(['=CMD()', '+SUM(1,1)', '-2+3', '@IMPORTDATA("x")', '\t=1', '\r=1'])(
    'neutralizes spreadsheet formula cell %s',
    (value) => expect(escapeCsvCell(value)).toMatch(/^"?'(?:\t|\r)?[=+\-@]/),
  );

  it('quotes commas, quotes, and newlines', () => {
    expect(escapeCsvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
});
