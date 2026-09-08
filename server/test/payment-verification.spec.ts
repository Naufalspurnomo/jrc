import { TicketStatus } from '@prisma/client';
import QRCode from 'qrcode';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashTicketToken, deriveTicketToken } from '../src/common/ticket-token';
import { PaymentVerificationService } from '../src/payment-verification';
import { PrismaService } from '../src/prisma.service';

const ORIGINAL_ENV = { ...process.env };
const qrCodePromiseApi = QRCode as unknown as {
  toDataURL(text: string, options?: object): Promise<string>;
};

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

function serviceWithRegistration(registration: object): PaymentVerificationService {
  const prisma = {
    registration: {
      findFirst: vi.fn().mockResolvedValue(registration),
    },
  };
  return new PaymentVerificationService(prisma as unknown as PrismaService);
}

describe('participant ticket response', () => {
  it('returns safe ticket fields and encodes the verification URL in the QR image', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TICKET_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.PUBLIC_VERIFICATION_URL =
      'https://tickets.example.test/ticket/verify?source=portal';

    const ticketId = '7c60de75-6794-49de-8292-8b53a417ab1d';
    const token = deriveTicketToken(ticketId, process.env.TICKET_SECRET);
    const issuedAt = new Date('2026-09-07T12:34:56.000Z');
    const service = serviceWithRegistration({
      teamName: 'Garuda Robotika',
      registrationNumber: 'JRC14-2026-0001',
      competition: {
        name: 'Colosseum Clash — Sumo',
        eventId: 'JRC-XIV-2026',
        eventName: 'JRC XIV 2026',
      },
      ticket: {
        id: ticketId,
        tokenHash: hashTicketToken(token),
        status: TicketStatus.ACTIVE,
        issuedAt,
      },
    });
    const qrSpy = vi
      .spyOn(qrCodePromiseApi, 'toDataURL')
      .mockResolvedValue('data:image/png;base64,cXItcG5n');

    const result = await service.getTicket('owner-id', 'registration-id');
    const verificationUrl = new URL(result.verificationUrl);

    expect(verificationUrl.origin + verificationUrl.pathname).toBe(
      'https://tickets.example.test/ticket/verify',
    );
    expect(verificationUrl.searchParams.get('source')).toBe('portal');
    expect(verificationUrl.searchParams.get('token')).toBe(token);
    expect(verificationUrl.searchParams.get('eventId')).toBe('JRC-XIV-2026');
    expect(qrSpy).toHaveBeenCalledWith(result.verificationUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      type: 'image/png',
    });
    expect(result).toEqual({
      token,
      verificationUrl: verificationUrl.toString(),
      qrDataUrl: 'data:image/png;base64,cXItcG5n',
      status: TicketStatus.ACTIVE,
      teamName: 'Garuda Robotika',
      registrationNumber: 'JRC14-2026-0001',
      competitionName: 'Colosseum Clash — Sumo',
      eventName: 'JRC XIV 2026',
      issuedAt: '2026-09-07T12:34:56.000Z',
    });
    expect(qrSpy.mock.calls[0]?.[0]).not.toBe(token);
  });

  it.each([
    ['ftp://tickets.example.test/ticket/verify', 'http or https'],
    ['https://user:password@tickets.example.test/ticket/verify', 'credentials'],
    ['not a URL', 'valid URL'],
  ])('rejects unsafe PUBLIC_VERIFICATION_URL %s', async (configuredUrl, message) => {
    process.env.NODE_ENV = 'test';
    process.env.TICKET_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.PUBLIC_VERIFICATION_URL = configuredUrl;
    const ticketId = '7c60de75-6794-49de-8292-8b53a417ab1d';
    const token = deriveTicketToken(ticketId, process.env.TICKET_SECRET);
    const service = serviceWithRegistration({
      teamName: 'Garuda Robotika',
      registrationNumber: 'JRC14-2026-0001',
      competition: {
        name: 'Colosseum Clash — Sumo',
        eventId: 'JRC-XIV-2026',
        eventName: 'JRC XIV 2026',
      },
      ticket: {
        id: ticketId,
        tokenHash: hashTicketToken(token),
        status: TicketStatus.ACTIVE,
        issuedAt: new Date('2026-09-07T12:34:56.000Z'),
      },
    });

    await expect(service.getTicket('owner-id', 'registration-id')).rejects.toThrow(
      message,
    );
  });

  it('uses the local verification URL only outside production', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TICKET_SECRET = 'test-secret-at-least-32-characters-long';
    delete process.env.PUBLIC_VERIFICATION_URL;
    const ticketId = '7c60de75-6794-49de-8292-8b53a417ab1d';
    const token = deriveTicketToken(ticketId, process.env.TICKET_SECRET);
    const service = serviceWithRegistration({
      teamName: 'Garuda Robotika',
      registrationNumber: 'JRC14-2026-0001',
      competition: {
        name: 'Colosseum Clash — Sumo',
        eventId: 'JRC-XIV-2026',
        eventName: 'JRC XIV 2026',
      },
      ticket: {
        id: ticketId,
        tokenHash: hashTicketToken(token),
        status: TicketStatus.ACTIVE,
        issuedAt: new Date('2026-09-07T12:34:56.000Z'),
      },
    });
    vi.spyOn(qrCodePromiseApi, 'toDataURL').mockResolvedValue(
      'data:image/png;base64,cXItcG5n',
    );

    const result = await service.getTicket('owner-id', 'registration-id');

    expect(result.verificationUrl).toBe(
      `http://localhost:5173/ticket/verify?token=${token}&eventId=JRC-XIV-2026`,
    );
  });

  it('requires PUBLIC_VERIFICATION_URL in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TICKET_SECRET = 'test-secret-at-least-32-characters-long';
    delete process.env.PUBLIC_VERIFICATION_URL;
    const ticketId = '7c60de75-6794-49de-8292-8b53a417ab1d';
    const token = deriveTicketToken(ticketId, process.env.TICKET_SECRET);
    const service = serviceWithRegistration({
      teamName: 'Garuda Robotika',
      registrationNumber: 'JRC14-2026-0001',
      competition: {
        name: 'Colosseum Clash — Sumo',
        eventId: 'JRC-XIV-2026',
        eventName: 'JRC XIV 2026',
      },
      ticket: {
        id: ticketId,
        tokenHash: hashTicketToken(token),
        status: TicketStatus.ACTIVE,
        issuedAt: new Date('2026-09-07T12:34:56.000Z'),
      },
    });

    await expect(service.getTicket('owner-id', 'registration-id')).rejects.toThrow(
      'PUBLIC_VERIFICATION_URL is required in production',
    );
  });
});