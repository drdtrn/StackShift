'use client';

import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { PortalSessionSchema, type PortalSession } from '@/app/lib/billing-schemas';

export type BillingPortalFlow = 'Default' | 'SubscriptionUpdate';

export interface BillingPortalVars {
  flow?: BillingPortalFlow;
}

export function useBillingPortal() {
  return useMutation<PortalSession, AxiosError, BillingPortalVars | void>({
    mutationFn: async (vars) => {
      const flow = vars && 'flow' in vars ? vars.flow ?? 'Default' : 'Default';
      const response = await apiClient.post(
        '/api/v1/billing/portal-session',
        { flow },
        { schema: PortalSessionSchema },
      );
      return response.data;
    },
  });
}
