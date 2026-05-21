'use client';

import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { PortalSessionSchema, type PortalSession } from '@/app/lib/billing-schemas';

export function useBillingPortal() {
  return useMutation<PortalSession, AxiosError, void>({
    mutationFn: async () => {
      const response = await apiClient.post('/api/v1/billing/portal-session', {}, {
        schema: PortalSessionSchema,
      });
      return response.data;
    },
  });
}
