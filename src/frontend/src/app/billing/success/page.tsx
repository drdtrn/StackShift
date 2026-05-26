'use client';

import { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/app/hooks/useSession';
import { useSyncCheckoutSession } from '@/app/hooks/mutations/use-sync-checkout-session';
import { Spinner } from '@/app/components/ui/Spinner';

function CheckoutSuccess() {
  const params = useSearchParams();
  // The success URL Stripe redirects to is configured with ?session={CHECKOUT_SESSION_ID}.
  // Older sessions may also have used ?session_id=… so accept both for safety.
  const sessionId = params.get('session') ?? params.get('session_id');

  const { isLoading: sessionLoading, isAuthenticated } = useSession();
  const sync = useSyncCheckoutSession();
  const launchedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || sessionLoading || !isAuthenticated) return;
    if (launchedRef.current) return;
    launchedRef.current = true;
    sync.mutate(sessionId);
  }, [sessionId, sessionLoading, isAuthenticated, sync]);

  // No session id means someone landed here outside the Stripe redirect flow —
  // show the dashboard handoff without trying to reconcile anything.
  if (!sessionId) {
    return (
      <div className="flex flex-col items-center text-center gap-6">
        <h1 className="text-3xl font-bold">You&rsquo;re in.</h1>
        <p className="text-muted">Your subscription should be active in a few seconds.</p>
        <Link href="/" className="text-sm underline text-blue-600 hover:text-blue-700 dark:text-blue-400">
          Back to dashboard
        </Link>
      </div>
    );
  }

  // If the BFF session was lost during the Stripe checkout window, prompt the
  // user to sign back in. The session_id is preserved in the `next` URL so the
  // sync runs automatically once they're back.
  if (!sessionLoading && !isAuthenticated) {
    const next = encodeURIComponent(`/billing/success?session=${sessionId}`);
    return (
      <div className="flex flex-col items-center text-center gap-6">
        <h1 className="text-3xl font-bold">Payment received.</h1>
        <p className="text-muted">
          Sign back in to activate your new plan — your purchase is already recorded.
        </p>
        <Link
          href={`/landing?next=${next}`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <h1 className="text-3xl font-bold">You&rsquo;re in.</h1>

      {sync.isPending || sessionLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner size="sm" /> Activating your plan…
        </div>
      ) : null}

      {sync.isSuccess && (
        <p className="text-sm text-muted">
          Your new plan is now active{sync.data?.plan ? ` — ${sync.data.plan}` : ''}.
        </p>
      )}

      {sync.isError && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          We couldn&rsquo;t confirm your subscription instantly. It will switch on within a few
          seconds — refresh if it doesn&rsquo;t.
        </p>
      )}

      <Link href="/" className="text-sm underline text-blue-600 hover:text-blue-700 dark:text-blue-400">
        Back to dashboard
      </Link>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <CheckoutSuccess />
    </Suspense>
  );
}
