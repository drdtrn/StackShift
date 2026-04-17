import type { Metadata } from 'next';
import { Skeleton } from '@/app/components/ui/Skeleton';

export const metadata: Metadata = { title: 'Alerts | StackSift' };

export default function AlertsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-28" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
