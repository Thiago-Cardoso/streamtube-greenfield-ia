import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test-utils/render';
import { ResetPasswordForm } from './reset-password-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ResetPasswordForm', () => {
  it('shows confirmPassword error when passwords do not match', async () => {
    render(<ResetPasswordForm token="tok123" />);
    await userEvent.type(screen.getByLabelText('New password'), 'password123');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'different');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('submits with token and new_password on matching passwords', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ResetPasswordForm token="valid-tok" />);
    await userEvent.type(screen.getByLabelText('New password'), 'newpassword1');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'newpassword1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.token).toBe('valid-tok');
    expect(body.new_password).toBe('newpassword1');
  });

  it('shows success message on 204 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );
    render(<ResetPasswordForm token="valid-tok" />);
    await userEvent.type(screen.getByLabelText('New password'), 'newpassword1');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'newpassword1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows TOKEN_EXPIRED message with link to forgot-password', async () => {
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
    render(<ResetPasswordForm token="expired-tok" />);
    await userEvent.type(screen.getByLabelText('New password'), 'newpassword1');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'newpassword1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/link expired/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /request a new link/i }),
    ).toHaveAttribute('href', '/auth/forgot-password');
  });
});
