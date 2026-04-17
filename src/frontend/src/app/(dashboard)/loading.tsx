import { Skeleton } from '@/app/components/ui/Skeleton';

/**
 * Dashboard loading state — shown while the overview page fetches data.
 *
 * Next.js renders this file automatically during navigation or data loading.
 * It mirrors the structure of page.tsx so the layout shift is minimal when
 * real content replaces the skeletons.
 *
 * 3 metric card skeletons match the 3 real metric cards (Active Alerts,
 * Total Logs Today, Open Incidents). A large area below represents either
 * the EmptyState or future content panels.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* 3 metric card skeletons */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Empty state / content area skeleton */}
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
