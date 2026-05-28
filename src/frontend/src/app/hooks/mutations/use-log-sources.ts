'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import {
  LogSourceCreatedSchema,
  TestIngestResultSchema,
} from '@/app/lib/api-schemas';
import { useApiError } from '@/app/hooks/useApiError';
import { useToastStore } from '@/app/hooks/useToastStore';
import type { LogSourceCreated, LogSourceType, TestIngestResult } from '@/app/types';

interface CreateLogSourceInput {
  projectId: string;
  name: string;
  type: LogSourceType;
}

interface DeleteLogSourceInput {
  id: string;
  projectId: string;
}

export function useCreateLogSource() {
  const queryClient = useQueryClient();
  const handleApiError = useApiError();

  return useMutation<LogSourceCreated, AxiosError, CreateLogSourceInput>({
    mutationFn: async (input) => {
      const response = await apiClient.post<LogSourceCreated>(
        `/api/v1/projects/${input.projectId}/log-sources`,
        { name: input.name, type: input.type },
        { schema: LogSourceCreatedSchema },
      );
      return response.data;
    },
    onSuccess: async (created, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.logSources.byProject(input.projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.logSources.organization() });
      queryClient.setQueryData(queryKeys.logSources.detail(created.logSource.id), created.logSource);
    },
    onError: handleApiError,
  });
}

export function useRegenerateLogSourceKey() {
  const queryClient = useQueryClient();
  const handleApiError = useApiError();

  return useMutation<LogSourceCreated, AxiosError, string>({
    mutationFn: async (id) => {
      const response = await apiClient.post<LogSourceCreated>(
        `/api/v1/log-sources/${id}/regenerate-key`,
        null,
        { schema: LogSourceCreatedSchema },
      );
      return response.data;
    },
    onSuccess: async (created) => {
      queryClient.setQueryData(queryKeys.logSources.detail(created.logSource.id), created.logSource);
      await queryClient.invalidateQueries({ queryKey: queryKeys.logSources.all });
    },
    onError: handleApiError,
  });
}

export function useDeleteLogSource() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const handleApiError = useApiError();

  return useMutation<void, AxiosError, DeleteLogSourceInput>({
    mutationFn: async (input) => {
      await apiClient.delete(`/api/v1/log-sources/${input.id}`);
    },
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.logSources.all });
      router.push(`/projects/${input.projectId}`);
    },
    onError: handleApiError,
  });
}

export function useTestIngest() {
  const addToast = useToastStore((s) => s.addToast);
  const handleApiError = useApiError();

  return useMutation<TestIngestResult, AxiosError, string>({
    mutationFn: async (id) => {
      const response = await apiClient.post<TestIngestResult>(
        `/api/v1/log-sources/${id}/test-ingest`,
        null,
        { schema: TestIngestResultSchema },
      );
      return response.data;
    },
    onSuccess: (result) => {
      addToast({
        variant: 'success',
        message: `Sent at ${new Date(result.sentAt).toLocaleTimeString()}`,
        action: { label: 'View in live tail', href: '/logs' },
      });
    },
    onError: handleApiError,
  });
}
