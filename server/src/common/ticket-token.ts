import { createHash, createHmac, randomBytes } from 'node:crypto';

export function newTicketToken(): string {
  return randomBytes(32).toString('base64url');
}

export function deriveTicketToken(ticketId: string, secret: string): string {
  return createHmac('sha256', secret).update(`jrc-ticket-v1:${ticketId}`).digest('base64url');
}

export function hashTicketToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
