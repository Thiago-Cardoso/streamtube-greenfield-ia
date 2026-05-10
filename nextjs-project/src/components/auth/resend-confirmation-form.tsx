'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

export function ResendConfirmationForm() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch('/auth/resend-confirmation', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => setSent(true),
    onError: () => setSent(true),
  });

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        If your email is registered and unconfirmed, a new link has been sent.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      noValidate
      className="space-y-3 mt-4"
    >
      <div className="space-y-1">
        <Label htmlFor="resend-email">Email</Label>
        <Input
          id="resend-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        variant="outline"
        className="w-full"
        disabled={isSubmitting || mutation.isPending}
      >
        {mutation.isPending ? 'Sending…' : 'Resend confirmation email'}
      </Button>
    </form>
  );
}
