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

  it('prefixes CSRF and API requests with a configured HTTPS origin', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-123' }), {
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new ApiClient(fetcher, 'https://api.example.com');

    await client.request('/api/registrations/reg-1', { method: 'DELETE' });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/api/auth/csrf',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/api/registrations/reg-1',
      expect.objectContaining({ credentials: 'include', method: 'DELETE' }),
    );
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

  it('loads the read-only paid-team list with encoded filters', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      items: [], page: 2, pageSize: 25, hasNextPage: false,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const api = createRegistrationApi(new ApiClient(fetcher));

    await api.admin.listPaidTeams({ query: 'Garuda & PENS', page: 2, pageSize: 25 });

    expect(fetcher).toHaveBeenCalledWith(
      '/api/admin/paid-teams?query=Garuda+%26+PENS&page=2&pageSize=25',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
  });

  it('loads a paid-team detail from the dedicated read-only route', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const api = createRegistrationApi(new ApiClient(fetcher));

    await api.admin.getPaidTeam('registration/1');

    expect(fetcher).toHaveBeenCalledWith(
      '/api/admin/paid-teams/registration%2F1',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
  });

  it('deletes an admin registration with CSRF protection', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-123' }), {
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true, cleanupWarnings: [] }), {
        headers: { 'Content-Type': 'application/json' },
      }));
    const api = createRegistrationApi(new ApiClient(fetcher));

    await expect(api.admin.deleteRegistration('registration/1')).resolves.toEqual({
      deleted: true,
      cleanupWarnings: [],
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/api/admin/registrations/registration%2F1',
      expect.objectContaining({
        credentials: 'include',
        method: 'DELETE',
        headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-123' }),
      }),
    );
  });

  it('downloads authenticated admin XLSX exports as binary blobs', async () => {
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(new Uint8Array([80, 75, 3, 4]), {
      status: 200,
      headers: { 'Content-Type': mime },
    }));
    const api = createRegistrationApi(new ApiClient(fetcher));

    const registrations = await api.admin.exportRegistrations();
    const attendance = await api.admin.exportAttendance();

    expect(registrations).toMatchObject({ size: 4, type: mime });
    expect(attendance).toMatchObject({ size: 4, type: mime });
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      '/api/admin/registrations/export.xlsx',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/api/admin/registrations/attendance.xlsx',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
  });
});