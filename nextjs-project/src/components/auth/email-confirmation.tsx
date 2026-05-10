'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiFetch, ApiError } from '@/lib/api';
import { ResendConfirmationForm } from './resend-confirmation-form';

interface Props {
  token: string;
}

export function EmailConfirmation({ token }: Props) {
  const { isPending, isSuccess, error } = useQuery({
    queryKey: ['confirm-email', token],
    queryFn: () =>
      apiFetch(`/auth/confirm-email?token=${encodeURIComponent(token)}`).then(
        () => true as const,
      ),
    enabled: !!token,
    retry: false,
  });

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirming your email…</CardTitle>
          <CardDescription>Please wait a moment.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email confirmed!</CardTitle>
          <CardDescription>
            Your account is now active.{' '}
            <Link href="/auth/login" className="underline">
              Sign in
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const domainError = error instanceof ApiError ? error.error : 'UNKNOWN';
  const isExpired = domainError === 'TOKEN_EXPIRED';
  const heading = isExpired ? 'Link expired' : 'Invalid link';
  const description = isExpired
    ? 'This confirmation link has expired.'
    : 'This link is invalid or has already been used.';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <div className="px-6 pb-6">
        <ResendConfirmationForm />
      </div>
    </Card>
  );
}
