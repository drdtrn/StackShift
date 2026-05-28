'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { AiAnalysisSchema, type AiAnalysisFromSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import { useApiError } from '@/app/hooks/useApiError';

interface TriggerVars {
  incidentId: string;
}

export function useTriggerAiAnalysis() {
  const queryClient = useQueryClient();
  const handleError = useApiError();

  return useMutation<AiAnalysisFromSchema, Error, TriggerVars>({
    mutationFn: async ({ incidentId }) => {
      const response = await apiClient.post(
        `/api/v1/incidents/${incidentId}/analyze`,
        undefined,
        { schema: AiAnalysisSchema },
      );
      return response.data;
    },

    onSuccess: (analysis) => {
      queryClient.setQueryData(queryKeys.aiAnalyses.detail(analysis.id), analysis);
      queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.detail(analysis.incidentId),
      });
    },

    onError: (err) => {
      // Plan-cap is a 402; the global apiClient interceptor surfaces the
      // upgrade toast with the action button. Only other errors bubble here.
      if (isAxiosError(err) && err.response?.status === 402) return;
      handleError(err);
    },
  });
}
