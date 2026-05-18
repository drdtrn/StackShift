'use client';

import { useQuery, type Query } from '@tanstack/react-query';
import { apiClient } from '@/app/lib/api-client';
import { AiAnalysisSchema, type AiAnalysisFromSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';

const POLL_INTERVAL_MS = 5_000;

export function useAiAnalysis(id: string | null | undefined) {
  return useQuery<AiAnalysisFromSchema>({
    queryKey: queryKeys.aiAnalyses.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/ai-analyses/${id}`, {
        schema: AiAnalysisSchema,
      });
      return response.data;
    },
    refetchInterval: (query: Query<AiAnalysisFromSchema>) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
    staleTime: POLL_INTERVAL_MS,
  });
}
