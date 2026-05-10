'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiFetch, ApiError } from '@/lib/api';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

type ErrorState = 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | null;

interface Props {
  token: string;
}

export function ResetPasswordForm({ token }: Props) {
  const [succeeded, setSucceeded] = useState(false);
  const [tokenError, setTokenError] = useState<ErrorState>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: data.newPassword }),
      }),
    onSuccess: () => setSucceeded(true),
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.error === 'INVALID_TOKEN' || err.error === 'TOKEN_EXPIRED') {
          setTokenError(err.error);
        } else {
          setError('newPassword', { message: err.message });
        }
      }
    },
  });

  if (succeeded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password updated</CardTitle>
          <CardDescription>
            Your password has been changed.{' '}
            <Link href="/auth/login" className="underline">
              Sign in
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (tokenError) {
    const heading =
      tokenError === 'TOKEN_EXPIRED' ? 'Link expired' : 'Invalid link';
    const description =
      tokenError === 'TOKEN_EXPIRED'
        ? 'This reset link has expired.'
        : 'This reset link is invalid or has already been used.';

    return (
      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>
            {description}{' '}
            <Link href="/auth/forgot-password" className="underline">
              Request a new link
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          noValidate
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive" role="alert">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || mutation.isPending}
          >
            {mutation.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
