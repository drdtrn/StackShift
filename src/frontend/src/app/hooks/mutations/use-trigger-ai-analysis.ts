'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { AiAnalysisSchema, type AiAnalysisFromSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import { useApiError } from '@/app/hooks/useApiError';
import { useToastStore } from '@/app/hooks/useToastStore';

interface TriggerVars {
  incidentId: string;
}

export function useTriggerAiAnalysis() {
  const queryClient = useQueryClient();
  const handleError = useApiError();
  const addToast = useToastStore((s) => s.addToast);

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
      // Seed the cache so useAiAnalysis(id) renders the Pending state
      // immediately instead of flashing through isLoading for ~5s.
      queryClient.setQueryData(queryKeys.aiAnalyses.detail(analysis.id), analysis);

      // The parent incident's aiAnalysisId is now non-null; refresh it.
      queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.detail(analysis.incidentId),
      });
    },

    onError: (err) => {
      // Plan-cap (429) is informational, not a hard failure — bypass the
      // generic error handler so the user sees an actionable upgrade nudge.
      if (isAxiosError(err) && err.response?.status === 429) {
        addToast({
          variant: 'warning',
          message:
            'You have reached this month’s AI-analysis limit on your plan. Upgrade to run more.',
        });
        return;
      }
      handleError(err);
    },
  });
}
