import type { Metadata } from 'next';
import { Skeleton } from '@/app/components/ui/Skeleton';

export const metadata: Metadata = { title: 'Logs | StackSift' };

export default function LogsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
