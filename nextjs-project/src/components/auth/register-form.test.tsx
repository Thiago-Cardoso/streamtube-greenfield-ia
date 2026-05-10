import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test-utils/render';
import { RegisterForm } from './register-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('RegisterForm', () => {
  it('renders email, password, and confirmPassword fields', () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows validation error when email is empty on submit', async () => {
    render(<RegisterForm />);
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(
      await screen.findByText(/enter a valid email/i),
    ).toBeInTheDocument();
  });

  it('shows error when password is shorter than 8 characters', async () => {
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(
      await screen.findByText(/at least 8 characters/i),
    ).toBeInTheDocument();
  });

  it('shows confirmPassword error when passwords do not match', async () => {
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'password123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(
      await screen.findByText(/passwords do not match/i),
    ).toBeInTheDocument();
  });

  it('shows success message on successful registration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ id: 'u1', email: 'a@b.com' }),
            { status: 201 },
          ),
        ),
      ),
    );
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'password123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it('shows EMAIL_ALREADY_EXISTS error on email field', async () => {
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
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'exists@b.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'password123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(
      await screen.findByText(/already registered/i),
    ).toBeInTheDocument();
  });
});
