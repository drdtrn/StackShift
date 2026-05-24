'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@/app/components/ui';
import { useSession } from '@/app/hooks/useSession';
import { useToastStore } from '@/app/hooks/useToastStore';
import { loginSchema, type LoginFormValues } from '@/app/lib/schemas/auth';

const AUTH_ERRORS: Record<string, string> = {
  auth_cancelled: 'Sign-in was cancelled. Please try again.',
  missing_params: 'Authentication failed. Please try again.',
  invalid_state: 'Authentication session expired. Please try again.',
  token_exchange_failed: 'Could not complete sign-in. Please try again later.',
};

function safeNextParam(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function resolveNext(searchParams: URLSearchParams | { get(key: string): string | null }): string {
  const rawNext = safeNextParam(searchParams.get('next'));
  const plan = searchParams.get('plan')?.toLowerCase() ?? null;
  const from = searchParams.get('from') ?? null;
  const isUpgradePlan = plan === 'indie' || plan === 'team';
  if (!isUpgradePlan) return rawNext;
  return `/billing/checkout?plan=${plan}${from ? `&from=${encodeURIComponent(from)}` : ''}`;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { isAuthenticated, isLoading } = useSession();

  const error = searchParams.get('error');
  const next = resolveNext(searchParams);
  const ssoHref = `/api/auth/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;

  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (error) {
      const message = AUTH_ERRORS[error] ?? 'Sign-in failed. Please try again.';
      addToast({ variant: 'error', message });
    }
  }, [error, addToast]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(next);
    }
  }, [isLoading, isAuthenticated, next, router]);

  async function onSubmit(values: LoginFormValues): Promise<void> {
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.status === 401) {
        addToast({ variant: 'error', message: 'Invalid email or password.' });
        return;
      }
      if (!response.ok) {
        addToast({ variant: 'error', message: 'Could not sign in. Please try again.' });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.replace(next);
    } catch {
      addToast({ variant: 'error', message: 'Could not sign in. Please try again.' });
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
        <h1 className="text-2xl font-semibold">Sign in to StackSift</h1>
        <p className="text-sm text-muted">Welcome back.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          errorMessage={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          errorMessage={errors.password?.message}
          {...register('password')}
        />
        <div className="flex justify-end">
          <Link href="/login/forgot" className="text-xs text-blue-500 hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>

      <Button type="submit" variant="primary" loading={submitting} className="w-full">
        Sign in
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-line" aria-hidden />
        or
        <div className="h-px flex-1 bg-line" aria-hidden />
      </div>

      <a
        href={`${ssoHref}${ssoHref.includes('?') ? '&' : '?'}provider=google`}
        className="flex w-full items-center justify-center rounded-lg border border-line bg-elevated px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Continue with Google
      </a>

      <p className="text-center text-xs text-muted">
        New here?{' '}
        <Link href="/register" className="text-blue-500 hover:underline">
          Create an account
        </Link>
        .
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-xl">
          <div className="h-8 w-48 rounded bg-elevated animate-pulse" />
          <div className="h-12 w-full rounded-lg bg-elevated animate-pulse" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
