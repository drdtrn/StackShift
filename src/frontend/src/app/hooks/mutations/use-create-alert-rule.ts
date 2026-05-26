'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';
import { useToastStore } from '@/app/hooks/useToastStore';
import { queryKeys } from '@/app/lib/query-keys';
import type { AlertRuleFormInput } from '@/app/lib/schemas/alert-rule';
import type { AlertRule, AlertRuleCondition, LogLevel } from '@/app/types';
import { apiClient } from '@/app/lib/api-client';
import { AlertRuleSchema } from '@/app/lib/api-schemas';
import { useApiError } from '@/app/hooks/useApiError';

interface AlertRuleBody {
  projectId: string;
  name: string;
  condition: AlertRuleCondition;
  threshold: number | null;
  windowMinutes: number;
  logLevel: LogLevel | null;
  pattern: string | null;
}

interface UpdateAlertRuleInput extends AlertRuleBody {
  id: string;
  isActive: boolean;
}

function mapAlertRuleFormToBackend(input: AlertRuleFormInput): AlertRuleBody {
  const base = {
    projectId: input.projectId,
    name: input.name,
  };

  switch (input.condition.type) {
    case 'ErrorRate':
    case 'LogVolume':
      return {
        ...base,
        condition: 'threshold',
        threshold: input.condition.threshold,
        windowMinutes: input.condition.windowMinutes,
        logLevel: null,
        pattern: null,
      };
    case 'PatternMatch':
      return {
        ...base,
        condition: 'pattern',
        threshold: null,
        windowMinutes: 1,
        logLevel: input.condition.logLevel ?? null,
        pattern: input.condition.pattern,
      };
    case 'Latency':
      return {
        ...base,
        condition: 'threshold',
        threshold: input.condition.thresholdMs,
        windowMinutes: 5,
        logLevel: null,
        pattern: null,
      };
  }
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const handleApiError = useApiError();

  const mutation = useMutation<AlertRule, AxiosError, AlertRuleFormInput>({
    mutationFn: async (input) => {
      const response = await apiClient.post<AlertRule>(
        '/api/v1/alert-rules',
        mapAlertRuleFormToBackend(input),
        { schema: AlertRuleSchema },
      );
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

    onError: handleApiError,
  });

  return {
    createAlertRule: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useUpdateAlertRule() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const handleApiError = useApiError();

  return useMutation<AlertRule, AxiosError, UpdateAlertRuleInput>({
    mutationFn: async ({ id, ...body }) => {
      const response = await apiClient.put<AlertRule>(
        `/api/v1/alert-rules/${id}`,
        body,
        { schema: AlertRuleSchema },
      );
      return response.data;
    },
    onSuccess: async (rule) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.alertRules.all });
      queryClient.setQueryData(queryKeys.alertRules.detail(rule.id), rule);
      addToast({ variant: 'success', message: `Alert rule "${rule.name}" updated.` });
    },
    onError: handleApiError,
  });
}

export function useDeleteAlertRule() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const handleApiError = useApiError();

  return useMutation<void, AxiosError, { id: string; name: string }>({
    mutationFn: async ({ id }) => {
      await apiClient.delete(`/api/v1/alert-rules/${id}`);
    },
    onSuccess: async (_data, { name }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.alertRules.all });
      addToast({ variant: 'success', message: `Alert rule "${name}" deleted.` });
    },
    onError: handleApiError,
  });
}
