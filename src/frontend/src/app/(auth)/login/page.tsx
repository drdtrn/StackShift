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
        aria-label="Sign in with Google via Keycloak"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
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

