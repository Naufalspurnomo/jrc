import { describe, expect, it, vi } from 'vitest';

import { ApiClient, API_PATHS, createRegistrationApi } from '../api';

describe('ApiClient', () => {
  it('loads a CSRF token and sends credentials on mutating requests', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'reg-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    const client = new ApiClient(fetcher);

    await client.request(API_PATHS.registrations.root, {
      method: 'POST',
      body: { competitionId: 'sumo' },
    });

    expect(fetcher).toHaveBeenNthCalledWith(1, API_PATHS.auth.csrf, expect.objectContaining({
      credentials: 'include',
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, API_PATHS.registrations.root, expect.objectContaining({
      credentials: 'include',
      method: 'POST',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-123' }),
    }));
  });

  it('does not set a JSON content type for multipart uploads', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-123' }), {
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new ApiClient(fetcher);
    const body = new FormData();
    body.append('file', new File(['proof'], 'proof.pdf', { type: 'application/pdf' }));

    await client.request('/api/registrations/reg-1/payment-proof', { method: 'POST', body });

    const headers = new Headers(fetcher.mock.calls[1]?.[1]?.headers);
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.get('X-CSRF-Token')).toBe('csrf-123');
  });

  it('uses the dedicated authenticated finance queue and proof paths', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const api = createRegistrationApi(new ApiClient(fetcher));

    await api.admin.listFinanceInvoices();

    expect(fetcher).toHaveBeenCalledWith(
      '/api/admin/finance/invoices',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
    expect(API_PATHS.admin.finance.invoices.proof('invoice/1')).toBe(
      '/api/admin/finance/invoices/invoice%2F1/proof',
    );
  });
});