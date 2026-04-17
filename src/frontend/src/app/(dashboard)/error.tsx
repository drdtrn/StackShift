'use client';

import { Card, CardBody } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';

/**
 * Dashboard error boundary.
 *
 * Next.js 16: `unstable_retry` replaces the old `reset()` prop. It re-fetches
 * server data and re-renders the entire boundary — more reliable than reset()
 * which only cleared client state.
 *
 * Scoped to the (dashboard) route group — the root error.tsx handles errors
 * that occur in layouts above this level (e.g. in Providers).
 */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-20">
      <Card role="alert" className="max-w-md w-full">
        <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-4xl" aria-hidden="true">⚠️</p>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Failed to load dashboard</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
              {error.message || 'An unexpected error occurred. Please try again.'}
            </p>
            {error.digest && (
              <p className="font-mono text-xs text-zinc-400 mt-1">ID: {error.digest}</p>
            )}
          </div>
          <Button onClick={unstable_retry} size="sm">
            Reload
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
