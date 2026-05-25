'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@/app/components/ui';
import { useToastStore } from '@/app/hooks/useToastStore';
import { AcceptInvitationResultSchema } from '@/app/lib/api-schemas';

const schema = z.object({
  password: z
    .string()
    .min(12, 'Must be at least 12 characters.')
    .regex(/[A-Z]/, 'Must contain an uppercase letter.')
    .regex(/[a-z]/, 'Must contain a lowercase letter.')
    .regex(/\d/, 'Must contain a digit.'),
  displayName: z.string().min(2, 'At least 2 characters.').max(80, 'At most 80 characters.'),
});

type FormValues = z.infer<typeof schema>;

function AcceptInvitationContent() {
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const token = search.get('token') ?? '';
  const [submitting, setSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', displayName: '' },
  });

  if (!token) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Missing invitation token</h1>
        <p className="text-sm text-muted">
          The invitation link is incomplete. Ask the person who invited you to send the
          email again.
        </p>
        <Link href="/landing" className="text-sm text-blue-500 hover:underline">
          Back to sign-in
        </Link>
      </div>
    );
  }

  async function onSubmit(values: FormValues): Promise<void> {
    setSubmitting(true);
    setTokenError(null);
    try {
      const acceptResponse = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: values.password,
          displayName: values.displayName,
        }),
      });

      if (acceptResponse.status === 409) {
        setTokenError('This invitation has expired or already been used.');
        return;
      }
      if (!acceptResponse.ok) {
        addToast({
          variant: 'error',
          message: 'Could not accept the invitation. Please try again.',
        });
        return;
      }

      const rawJson: unknown = await acceptResponse.json();
      const parsed = AcceptInvitationResultSchema.safeParse(rawJson);
      if (!parsed.success) {
        addToast({ variant: 'error', message: 'Unexpected response. Please try again.' });
        return;
      }

      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parsed.data.email, password: values.password }),
      });
      if (!loginResponse.ok) {
        addToast({
          variant: 'success',
          message: 'Account created — please sign in.',
        });
        router.replace('/login');
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      addToast({
        variant: 'success',
        message: "You're in. Welcome to the team.",
      });
      router.replace('/');
    } catch {
      addToast({
        variant: 'error',
        message: 'Could not accept the invitation. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-xl"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Accept invitation</h1>
        <p className="text-sm text-muted">Choose a password and your display name to join.</p>
      </div>

      {tokenError ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500" role="alert">
          {tokenError} <Link href="/landing" className="underline">Back to sign-in</Link>.
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <Input
          label="Display name"
          autoComplete="name"
          errorMessage={errors.displayName?.message}
          {...register('displayName')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          errorMessage={errors.password?.message}
          helperText="At least 12 characters, with an uppercase letter, a lowercase letter, and a digit."
          {...register('password')}
        />
      </div>

      <Button type="submit" variant="primary" loading={submitting} className="w-full">
        Accept and sign in
      </Button>
    </form>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-xl">
          <div className="h-8 w-48 rounded bg-elevated animate-pulse" />
          <div className="h-12 w-full rounded-lg bg-elevated animate-pulse" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
