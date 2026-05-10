import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, ApiError } from './api';
import { useAuthStore } from '@/store/auth.store';

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null });
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('sets Content-Type and does not set Authorization when no token', async () => {
    let capturedHeaders: HeadersInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts?: RequestInit) => {
        capturedHeaders = opts?.headers;
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );
      }),
    );

    await apiFetch('/test');

    const headers = capturedHeaders as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('injects Bearer Authorization header when access token is present', async () => {
    useAuthStore.setState({
      accessToken: 'my-token',
      user: { id: '1', email: 'a@a.com' },
    });

    let capturedHeaders: HeadersInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts?: RequestInit) => {
        capturedHeaders = opts?.headers;
        return Promise.resolve(
          new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
        );
      }),
    );

    await apiFetch('/protected');

    const headers = capturedHeaders as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-token');
  });

  it('throws ApiError on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              statusCode: 409,
              error: 'EMAIL_ALREADY_EXISTS',
              message: 'Email is already registered',
            }),
            { status: 409 },
          ),
        ),
      ),
    );

    await expect(apiFetch('/auth/register')).rejects.toThrow(ApiError);
    await expect(apiFetch('/auth/register')).rejects.toMatchObject({
      statusCode: 409,
      error: 'EMAIL_ALREADY_EXISTS',
      message: 'Email is already registered',
    });
  });

  it('returns undefined for 204 No Content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );

    const result = await apiFetch('/auth/logout');
    expect(result).toBeUndefined();
  });
});
