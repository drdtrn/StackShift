import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LogsView } from './_components/LogsView';
import { Skeleton } from '@/app/components/ui/Skeleton';

export const metadata: Metadata = { title: 'Log Explorer | StackSift' };

/**
 * Log Explorer — /logs
 *
 * Server component shell. LogsView is a Client Component that uses
 * useSearchParams, so it must be wrapped in <Suspense> to allow the rest of
 * the page to render statically while search-param reading happens client-side.
 */
export default function LogsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Log Explorer</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Filter, search, and browse logs across all projects.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-lg" />}>
        <LogsView />
      </Suspense>
    </div>
  );
}
