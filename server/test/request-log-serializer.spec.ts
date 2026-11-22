import { describe, expect, it } from 'vitest';
import { serializeRequestForLog } from '../src/app.module';

describe('serializeRequestForLog', () => {
  it('retains safe request metadata while removing query-bearing data', () => {
    const serialized = serializeRequestForLog({
      id: 'request-id',
      method: 'GET',
      url: '/api/ticket/verify?token=opaque-secret&eventId=event',
      headers: { authorization: 'Bearer opaque-secret' },
      query: { token: 'opaque-secret', eventId: 'event' },
      remoteAddress: '127.0.0.1',
      remotePort: 4321,
      raw: { url: '/api/ticket/verify?token=opaque-secret' },
    });
    const json = JSON.stringify(serialized);

    expect(serialized).toEqual({
      id: 'request-id',
      method: 'GET',
      url: '/api/ticket/verify',
      remoteAddress: '127.0.0.1',
      remotePort: 4321,
    });
    expect(json).not.toContain('opaque-secret');
    expect(json).not.toContain('query');
    expect(json).not.toContain('?token');
  });

  it('omits a structured request ID that could carry secret data', () => {
    expect(
      serializeRequestForLog({
        id: { token: 'opaque-secret' },
        url: '/api/ticket/verify',
      }),
    ).toEqual({ url: '/api/ticket/verify' });
  });

  it.each([
    [undefined, '/'],
    ['not a valid URL?token=opaque-secret', '/'],
    ['/api/%E0%A4%A?token=opaque-secret', '/'],
    ['https://jrc.example/api/ticket/verify?token=opaque-secret', '/'],
    ['/api/ticket/verify#token=opaque-secret', '/api/ticket/verify'],
  ])('handles unsafe URL %j without throwing', (url, pathname) => {
    expect(() => serializeRequestForLog({ url })).not.toThrow();
    expect(serializeRequestForLog({ url })).toEqual({ url: pathname });
    expect(JSON.stringify(serializeRequestForLog({ url }))).not.toContain(
      'opaque-secret',
    );
  });
});
