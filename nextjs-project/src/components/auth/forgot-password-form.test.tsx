import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test-utils/render';
import { ForgotPasswordForm } from './forgot-password-form';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ForgotPasswordForm', () => {
  it('renders email field and submit button', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows validation error for invalid email format', async () => {
    render(<ForgotPasswordForm />);
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
  });

  it('submits mutation on valid email', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('shows neutral success message after submit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(
      await screen.findByText(/if this email is registered/i),
    ).toBeInTheDocument();
  });
});
