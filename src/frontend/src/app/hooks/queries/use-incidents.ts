import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { MOCK_INCIDENTS } from '@/app/lib/mock-data';
import { useToastStore } from '@/app/hooks/useToastStore';
import type { Incident, IncidentStatus } from '@/app/types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// useIncidents — list incidents, optionally filtered by projectId
// ---------------------------------------------------------------------------

export function useIncidents(projectId?: string) {
  return useQuery<Incident[]>({
    queryKey: queryKeys.incidents.list(projectId),
    queryFn: async () => {
      await delay(300);
      if (projectId) {
        return MOCK_INCIDENTS.filter((i) => i.projectId === projectId);
      }
      return MOCK_INCIDENTS;
    },
  });
}

// ---------------------------------------------------------------------------
// useIncident — single incident by ID
// ---------------------------------------------------------------------------

export function useIncident(id: string) {
  return useQuery<Incident>({
    queryKey: queryKeys.incidents.detail(id),
    queryFn: async () => {
      await delay(300);
      const incident = MOCK_INCIDENTS.find((i) => i.id === id);
      if (!incident) throw new Error(`Incident not found: ${id}`);
      return incident;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// useMutateIncidentStatus — optimistic status update
//
// Demonstrates the canonical TanStack Query v5 mutation pattern:
//   1. onMutate: immediately update the cache (optimistic).
//   2. onError: roll back to the previous cache snapshot.
//   3. onSettled: always refetch to sync with server truth.
//
// When the real API is wired in, only the `mutationFn` body changes.
// ---------------------------------------------------------------------------

interface UpdateStatusVars {
  incidentId: string;
  status: IncidentStatus;
}

export function useMutateIncidentStatus() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  return useMutation<Incident, Error, UpdateStatusVars, { previous: Incident | undefined }>({
    mutationFn: async ({ incidentId, status }) => {
      await delay(500);
      const incident = MOCK_INCIDENTS.find((i) => i.id === incidentId);
      if (!incident) throw new Error(`Incident not found: ${incidentId}`);

      const now = new Date().toISOString();
      return {
        ...incident,
        status,
        acknowledgedAt: status === 'acknowledged' ? now : incident.acknowledgedAt,
        resolvedAt: status === 'resolved' ? now : incident.resolvedAt,
        closedAt: status === 'closed' ? now : incident.closedAt,
      };
    },

    onMutate: async ({ incidentId, status }) => {
      // Cancel any in-flight fetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({
        queryKey: queryKeys.incidents.detail(incidentId),
      });

      // Snapshot the current cache so we can roll back on error
      const previous = queryClient.getQueryData<Incident>(
        queryKeys.incidents.detail(incidentId),
      );

      // Optimistically update the cache
      queryClient.setQueryData<Incident>(
        queryKeys.incidents.detail(incidentId),
        (old) => old ? { ...old, status } : old,
      );

      return { previous };
    },

    onError: (_error, { incidentId }, context) => {
      // Roll back to previous snapshot
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.incidents.detail(incidentId),
          context.previous,
        );
      }
      addToast({ variant: 'error', message: 'Failed to update incident status.' });
    },

    onSuccess: (_data, { status }) => {
      addToast({
        variant: 'success',
        message: `Incident marked as ${status}.`,
      });
    },

    onSettled: (_data, _error, { incidentId }) => {
      // Always refetch after mutation to sync with server
      void queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.detail(incidentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.lists(),
      });
    },
  });
}
