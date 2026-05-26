'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export default function CheckoutSuccessPage() {
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all });
  }, [queryClient]);

  return (
    <div className="flex flex-col items-center text-center py-16 gap-6">
      <h1 className="text-3xl font-bold">You&rsquo;re in.</h1>
      <p className="text-muted max-w-md">
        Your subscription is being activated. The new limits switch on within a few seconds.
      </p>
      <Link href="/" className="text-sm underline text-blue-600 hover:text-blue-700 dark:text-blue-400">
        Back to dashboard
      </Link>
    </div>
  );
}
