'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';
import { useToastStore } from '@/app/hooks/useToastStore';
import { useApiError } from '@/app/hooks/useApiError';
import { apiClient } from '@/app/lib/api-client';
import { queryKeys } from '@/app/lib/query-keys';
import type { AlertRuleFormInput } from '@/app/lib/schemas/alert-rule';
import type { AlertRule, AlertRuleCondition, LogLevel } from '@/app/types';

// ---------------------------------------------------------------------------
// CreateAlertRulePayload
//
// What the backend at POST /api/v1/alert-rules actually expects.
// The form uses rich discriminated-union condition types (ErrorRate, LogVolume,
// PatternMatch, Latency). This payload maps them to the domain's flat fields.
// ---------------------------------------------------------------------------

interface CreateAlertRulePayload {
  name: string;
  projectId: string;
  condition: AlertRuleCondition;
  threshold: number | null;
  windowMinutes: number;
  logLevel: LogLevel | null;
  pattern: string | null;
}

function mapFormToPayload(input: AlertRuleFormInput): CreateAlertRulePayload {
  const { name, projectId, condition } = input;

  switch (condition.type) {
    case 'ErrorRate':
      return { name, projectId, condition: 'threshold', threshold: condition.threshold, windowMinutes: condition.windowMinutes, logLevel: null, pattern: null };
    case 'LogVolume':
      return { name, projectId, condition: 'threshold', threshold: condition.threshold, windowMinutes: condition.windowMinutes, logLevel: null, pattern: null };
    case 'PatternMatch':
      return { name, projectId, condition: 'pattern', threshold: null, windowMinutes: 60, logLevel: condition.logLevel ?? null, pattern: condition.pattern };
    case 'Latency':
      return { name, projectId, condition: 'threshold', threshold: condition.thresholdMs, windowMinutes: 0, logLevel: null, pattern: null };
  }
}

// ---------------------------------------------------------------------------
// useCreateAlertRule
//
// POST /api/v1/alert-rules  (NOT the deleted /api/alert-rules local handler)
//
// On success: invalidates alertRules cache, shows toast, redirects to /alerts.
// ---------------------------------------------------------------------------

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const handleApiError = useApiError();

  const mutation = useMutation<AlertRule, AxiosError, AlertRuleFormInput>({
    mutationFn: async (input) => {
      const payload = mapFormToPayload(input);
      const response = await apiClient.post<AlertRule>('/api/v1/alert-rules', payload);
      return response.data;
    },

    onSuccess: async (rule) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.alertRules.all });

      addToast({
        variant: 'success',
        message: `Alert rule "${rule.name}" created successfully.`,
      });

      router.push('/alerts');
    },

    onError: (err) => {
      handleApiError(err);
    },
  });

  return {
    createAlertRule: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
