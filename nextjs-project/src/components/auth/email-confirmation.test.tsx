import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test-utils/render';
import { EmailConfirmation } from './email-confirmation';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('EmailConfirmation', () => {
  it('shows loading state while query is pending', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})), // never resolves
    );
    render(<EmailConfirmation token="tok123" />);
    expect(screen.getByText(/confirming your email/i)).toBeInTheDocument();
  });

  it('shows success state on 204 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(null, { status: 204 })),
      ),
    );
    render(<EmailConfirmation token="valid-token" />);
    expect(await screen.findByText(/email confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows resend form on INVALID_TOKEN error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              statusCode: 400,
              error: 'INVALID_TOKEN',
              message: 'Token invalid',
            }),
            { status: 400 },
          ),
        ),
      ),
    );
    render(<EmailConfirmation token="bad-token" />);
    expect(await screen.findByText(/invalid link/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend confirmation email/i })).toBeInTheDocument();
  });

  it('shows expired message and resend form on TOKEN_EXPIRED error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              statusCode: 400,
              error: 'TOKEN_EXPIRED',
              message: 'Token expired',
            }),
            { status: 400 },
          ),
        ),
      ),
    );
    render(<EmailConfirmation token="expired-token" />);
    expect(await screen.findByText(/link expired/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend confirmation email/i })).toBeInTheDocument();
  });
});
