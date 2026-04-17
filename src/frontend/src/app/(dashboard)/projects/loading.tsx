import type { Metadata } from 'next';
import { Skeleton } from '@/app/components/ui/Skeleton';

export const metadata: Metadata = { title: 'Projects | StackSift' };

export default function ProjectsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-28" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
