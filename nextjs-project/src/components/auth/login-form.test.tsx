import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test-utils/render';
import { LoginForm } from './login-form';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: () => ({ sub: 'u1', email: 'a@b.com' }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  mockPush.mockClear();
});

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('calls /api/auth/login and redirects on valid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ access_token: 'token.payload.sig' }),
            { status: 200 },
          ),
        ),
      ),
    );
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('shows INVALID_CREDENTIALS error on password field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              statusCode: 401,
              error: 'INVALID_CREDENTIALS',
              message: 'Invalid credentials',
            }),
            { status: 401 },
          ),
        ),
      ),
    );
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue('a@b.com');
  });

  it('shows EMAIL_NOT_CONFIRMED message with resend link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              statusCode: 403,
              error: 'EMAIL_NOT_CONFIRMED',
              message: 'Email not confirmed',
            }),
            { status: 403 },
          ),
        ),
      ),
    );
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/email not confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resend confirmation email/i })).toBeInTheDocument();
  });
});
