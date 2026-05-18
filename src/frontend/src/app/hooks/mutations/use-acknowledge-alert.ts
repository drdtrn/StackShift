'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import { useApiError } from '@/app/hooks/useApiError';
import type { Alert } from '@/app/types';

// ---------------------------------------------------------------------------
// useAcknowledgeAlert
//
// POST /api/v1/alerts/{id}/acknowledge  (NOT PATCH)
//
// Optimistic update: immediately sets acknowledgedAt on the cached alert so
// the UI responds instantly. Rolls back the snapshot on error.
// ---------------------------------------------------------------------------

type MutationContext = { previousAlerts: Alert[] | undefined };

export function useAcknowledgeAlert(projectId?: string) {
  const queryClient = useQueryClient();
  const handleApiError = useApiError();

  const mutation = useMutation<void, AxiosError, string, MutationContext>({
    mutationFn: async (alertId: string) => {
      await apiClient.post(`/api/v1/alerts/${alertId}/acknowledge`);
    },

    onMutate: async (alertId) => {
      const queryKey = queryKeys.alerts.list(projectId);
      await queryClient.cancelQueries({ queryKey });
      const previousAlerts = queryClient.getQueryData<Alert[]>(queryKey);

      queryClient.setQueryData<Alert[]>(queryKey, (old) =>
        old?.map((a) =>
          a.id === alertId
            ? { ...a, acknowledgedAt: new Date().toISOString() }
            : a,
        ),
      );

      return { previousAlerts };
    },

    onError: (err, _alertId, context) => {
      if (context?.previousAlerts !== undefined) {
        queryClient.setQueryData(queryKeys.alerts.list(projectId), context.previousAlerts);
      }
      handleApiError(err);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
    },
  });

  return {
    acknowledge: mutation.mutate,
    isPending: mutation.isPending,
  };
}
