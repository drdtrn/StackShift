'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToastStore } from '@/app/hooks/useToastStore';

// ---------------------------------------------------------------------------
// The /callback page is a fallback landing page.
//
// In the normal BFF flow the user is never meant to see this page directly:
//   1. Keycloak redirects to GET /api/auth/callback (a Route Handler)
//   2. The Route Handler exchanges the code, sets the cookie, and redirects
//      to / (or ?next= URL)
//   3. The user never lands on this page at all.
//
// However, we keep this page for two reasons:
//   a. If the Route Handler encounters a non-redirectable error and renders
//      this URL instead, we want a graceful loading state rather than a 404.
//   b. In local dev, Keycloak might redirect to /callback instead of
//      /api/auth/callback if misconfigured.
//
// If an ?error= param is present it means auth failed — show a toast and
// redirect back to /login after 2 seconds.
// ---------------------------------------------------------------------------

function CallbackContent() {
  const searchParams = useSearchParams();
  const { addToast } = useToastStore();
  const error = searchParams.get('error');

  useEffect(() => {
    if (error) {
      addToast({
        variant: 'error',
        message: 'Sign-in could not be completed. Redirecting to login…',
      });
      const t = setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [error, addToast]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface p-8 shadow-xl text-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-blue-500"
        role="status"
        aria-label="Completing sign-in"
      />
      <h1 className="text-lg font-medium">
        {error ? 'Something went wrong…' : 'Completing sign-in…'}
      </h1>
      <p className="text-sm text-muted">
        {error
          ? 'Redirecting you back to the login page.'
          : 'You will be redirected automatically.'}
      </p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface p-8 shadow-xl text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-blue-500" />
          <h1 className="text-lg font-medium">Completing sign-in…</h1>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
