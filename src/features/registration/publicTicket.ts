import type { TicketResult, TicketVerification } from './api';

export type PublicTicketVerification = Readonly<TicketVerification>;

const RESULTS: readonly TicketResult[] = [
  'VALID',
  'CHECKED_IN',
  'ALREADY_CHECKED_IN',
  'REVOKED',
  'UNKNOWN',
  'NOT_PAID',
  'WRONG_EVENT',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ownString(source: Record<string, unknown>, key: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeResult(value: unknown): TicketResult {
  return typeof value === 'string' && RESULTS.includes(value as TicketResult)
    ? value as TicketResult
    : 'UNKNOWN';
}

export function normalizePublicTicket(payload: unknown): PublicTicketVerification {
  const source = isRecord(payload) ? payload : {};
  const event = isRecord(source.event) ? source.event : {};

  return {
    result: normalizeResult(source.result),
    teamName: ownString(source, 'teamName'),
    institution: ownString(source, 'institution'),
    competitionName: ownString(source, 'competitionName') ?? ownString(source, 'competition'),
    registrationNumber: ownString(source, 'registrationNumber'),
    eventId: ownString(source, 'eventId'),
    eventName: ownString(source, 'eventName') ?? ownString(event, 'name'),
  };
}