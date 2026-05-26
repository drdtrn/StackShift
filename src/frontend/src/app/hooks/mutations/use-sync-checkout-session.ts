'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { queryKeys } from '@/app/lib/query-keys';
import { SubscriptionSchema, type Subscription } from '@/app/lib/billing-schemas';

// Reconciles the org's plan from a completed Stripe Checkout Session, in case
// the checkout.session.completed webhook never arrived. The /billing/success
// page calls this on load with the session_id from the URL. Backend is
// idempotent, so retrying is safe.
export function useSyncCheckoutSession() {
  const queryClient = useQueryClient();

  return useMutation<Subscription, AxiosError, string>({
    mutationFn: async (sessionId) => {
      const response = await apiClient.post(
        `/api/v1/billing/checkout-session/${encodeURIComponent(sessionId)}/sync`,
        {},
        { schema: SubscriptionSchema },
      );
      return response.data;
    },
    onSuccess: (subscription) => {
      queryClient.setQueryData(queryKeys.billing.subscription(), subscription);
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all });
    },
  });
}
