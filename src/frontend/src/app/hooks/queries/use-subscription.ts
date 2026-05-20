'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/app/lib/api-client';
import { queryKeys } from '@/app/lib/query-keys';
import { SubscriptionSchema, type Subscription } from '@/app/lib/billing-schemas';

export function useSubscription() {
  return useQuery<Subscription>({
    queryKey: queryKeys.billing.subscription(),
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/billing/subscription', {
        schema: SubscriptionSchema,
      });
      return response.data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
