'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/app/lib/api-client';
import { DashboardStatsSchema, type DashboardStatsFromSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';

// Backend caches the response in Redis for 60s; 30s staleTime keeps the UI
// fresh without hammering the cache before it could possibly hold new data.
const STATS_STALE_TIME_MS = 30_000;

export function useDashboardStats() {
  return useQuery<DashboardStatsFromSchema>({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/dashboard', {
        schema: DashboardStatsSchema,
      });
      return response.data;
    },
    staleTime: STATS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}
