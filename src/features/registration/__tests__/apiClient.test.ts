import { describe, expect, it, vi } from 'vitest';

import { ApiClient, API_PATHS, apiUrl, createRegistrationApi } from '../api';

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

  it('builds cross-origin API URLs without changing relative defaults', () => {
    expect(apiUrl('/api/health', '')).toBe('/api/health');
    expect(apiUrl('/api/health', 'https://api.example.test/')).toBe('https://api.example.test/api/health');
  });

  it('localizes invalid login feedback', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ message: 'Invalid email or password' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ));
    const client = new ApiClient(fetcher);

    await expect(client.request('/api/auth/login', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 401, message: 'Email atau kata sandi salah.' });
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

  it('loads every admin registration page before calculating dashboard totals', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: `registration-${index + 1}` }));
    const secondPage = Array.from({ length: 39 }, (_, index) => ({ id: `registration-${index + 101}` }));
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), {
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(secondPage), {
        headers: { 'Content-Type': 'application/json' },
      }));
    const api = createRegistrationApi(new ApiClient(fetcher));

    await expect(api.admin.listRegistrations()).resolves.toHaveLength(139);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      '/api/admin/registrations?page=1&pageSize=100',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/api/admin/registrations?page=2&pageSize=100',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
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

  it('reads and triggers authenticated live Google Sheets synchronization', async () => {
    const status = {
      enabled: true,
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      syncing: false,
      lastSyncedAt: '2026-11-16T04:00:00.000Z',
      lastError: null,
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-test' }), {
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...status,
        registrationCount: 2,
        attendanceCount: 5,
      }), {
        headers: { 'Content-Type': 'application/json' },
      }));
    const api = createRegistrationApi(new ApiClient(fetcher));

    await expect(api.admin.googleSheetsStatus()).resolves.toEqual(status);
    await expect(api.admin.syncGoogleSheets()).resolves.toMatchObject({
      enabled: true,
      registrationCount: 2,
      attendanceCount: 5,
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      '/api/admin/google-sheets',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      '/api/admin/google-sheets/sync',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
  });
});