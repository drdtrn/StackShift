'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/app/hooks/useSession';
import { useToastStore } from '@/app/hooks/useToastStore';

// ---------------------------------------------------------------------------
// Error messages shown when Keycloak redirects back with ?error=
// ---------------------------------------------------------------------------
const AUTH_ERRORS: Record<string, string> = {
  auth_cancelled: 'Sign-in was cancelled. Please try again.',
  missing_params: 'Authentication failed. Please try again.',
  invalid_state: 'Authentication session expired. Please try again.',
  token_exchange_failed: 'Could not complete sign-in. Please try again later.',
};

// Inner component — reads searchParams (must be wrapped in Suspense)
function LoginContent() {
  const { isAuthenticated, isLoading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToastStore();

  const next = searchParams.get('next') ?? '/';
  const error = searchParams.get('error');
  const loginHref = `/api/auth/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;

  // Show error toast if Keycloak redirected back with an error param.
  useEffect(() => {
    if (error) {
      const message = AUTH_ERRORS[error] ?? 'Sign-in failed. Please try again.';
      addToast({ variant: 'error', message });
    }
  }, [error, addToast]);

  // If already authenticated, redirect to dashboard (or ?next= URL).
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(next.startsWith('/') ? next : '/');
    }
  }, [isLoading, isAuthenticated, next, router]);

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Sign in to StackSift</h1>
        <p className="text-sm text-muted">
          AI-powered SRE &amp; log analysis platform
        </p>
      </div>

      {/* Sign-in button — href triggers /api/auth/login which starts OIDC flow */}
      <a
        href={loginHref}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-elevated px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-line hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Sign in to StackSift"
      >
        Sign in
      </a>

      <p className="text-center text-xs text-muted">
        By signing in you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
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

