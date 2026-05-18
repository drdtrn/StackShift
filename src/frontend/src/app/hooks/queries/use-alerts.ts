import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { MOCK_ALERTS } from '@/app/lib/mock-data';
import { useToastStore } from '@/app/hooks/useToastStore';
import type { Alert, AlertSeverity } from '@/app/types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// useAlerts — list alerts, optionally filtered by projectId
// ---------------------------------------------------------------------------

export function useAlerts(projectId?: string) {
  return useQuery<Alert[]>({
    queryKey: queryKeys.alerts.list(projectId),
    queryFn: async () => {
      await delay(300);
      if (projectId) {
        return MOCK_ALERTS.filter((a) => a.projectId === projectId);
      }
      return MOCK_ALERTS;
    },
  });
}

// ---------------------------------------------------------------------------
// useAlert — single alert by ID
// ---------------------------------------------------------------------------

export function useAlert(id: string) {
  return useQuery<Alert>({
    queryKey: queryKeys.alerts.detail(id),
    queryFn: async () => {
      await delay(300);
      const alert = MOCK_ALERTS.find((a) => a.id === id);
      if (!alert) throw new Error(`Alert not found: ${id}`);
      return alert;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// useCreateAlert — mutation stub for creating a new alert rule
// ---------------------------------------------------------------------------

interface CreateAlertInput {
  projectId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  return useMutation<Alert, Error, CreateAlertInput>({
    mutationFn: async (input) => {
      await delay(600);
      // Stub: return a new alert with a generated ID
      const newAlert: Alert = {
        id: `alert-${Date.now()}`,
        projectId: input.projectId,
        alertRuleId: null,
        severity: input.severity,
        title: input.title,
        description: input.description,
        firedAt: new Date().toISOString(),
        acknowledgedAt: null,
        resolvedAt: null,
        incidentId: null,
      };
      return newAlert;
    },

    onSuccess: (_data, input) => {
      addToast({ variant: 'success', message: `Alert "${input.title}" created.` });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.alerts.list(input.projectId),
      });
    },

    onError: () => {
      addToast({ variant: 'error', message: 'Failed to create alert. Please try again.' });
    },
  });
}
