'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { IncidentSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import { useApiError } from '@/app/hooks/useApiError';
import { useToastStore } from '@/app/hooks/useToastStore';
import type { Incident, IncidentStatus } from '@/app/types';

// ---------------------------------------------------------------------------
// useUpdateIncidentStatus
//
// PATCH /api/v1/incidents/{id}/status with body { status }
// The backend validates the transition; an invalid transition (e.g. Open →
// Closed) returns 422 and is handled by useApiError.
//
// Optimistic update: immediately sets the new status in the cache so the UI
// reflects the change before the network round-trip completes. Rolled back
// on error.
//
// Status transition guard (enforced on both client and server):
//   Open → Acknowledged
//   Acknowledged → Resolved
//   Resolved → Closed
// ---------------------------------------------------------------------------

interface UpdateStatusVars {
  incidentId: string;
  status: IncidentStatus;
}

type MutationContext = { previous: Incident | undefined };

export function useUpdateIncidentStatus() {
  const queryClient = useQueryClient();
  const handleError = useApiError();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<Incident, AxiosError, UpdateStatusVars, MutationContext>({
    mutationFn: async ({ incidentId, status }) => {
      const response = await apiClient.patch<Incident>(
        `/api/v1/incidents/${incidentId}/status`,
        { status },
        { schema: IncidentSchema },
      );
      return response.data;
    },

    onMutate: async ({ incidentId, status }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.incidents.detail(incidentId),
      });

      const previous = queryClient.getQueryData<Incident>(
        queryKeys.incidents.detail(incidentId),
      );

      queryClient.setQueryData<Incident>(
        queryKeys.incidents.detail(incidentId),
        (old) => (old ? { ...old, status } : old),
      );

      return { previous };
    },

    onError: (err, { incidentId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.incidents.detail(incidentId),
          context.previous,
        );
      }
      handleError(err);
    },

    onSuccess: (_data, { status }) => {
      addToast({
        variant: 'success',
        message: `Incident marked as ${status}.`,
      });
    },

    onSettled: (_data, _error, { incidentId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.detail(incidentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.all,
      });
    },
  });
}
