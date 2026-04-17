'use client';

/**
 * Root error boundary — catches unhandled errors from the entire route tree.
 *
 * Next.js 16: the `unstable_retry` prop replaces the old `reset()` function.
 * It re-fetches server data AND re-renders the error boundary (unlike `reset()`
 * which only re-rendered client-side state). The `unstable_` prefix signals the
 * API may be renamed in a minor release — no logic changes expected.
 *
 * `error.tsx` must be a Client Component ('use client') because it receives
 * the thrown Error object as a prop, which cannot be serialised across the
 * server/client boundary.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center px-4">
      <p className="text-6xl font-bold text-red-300 dark:text-red-800">!</p>
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-zinc-500 max-w-sm">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-zinc-400">Error ID: {error.digest}</p>
      )}
      <button
        onClick={unstable_retry}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
