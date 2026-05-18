import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import { PaginatedResponseSchema, LogSourceSchema } from '@/app/lib/api-schemas';
import type { LogSource, PaginatedResponse } from '@/app/types';

// ---------------------------------------------------------------------------
// useProjectLogSources
//
// GET /api/v1/projects/{projectId}/log-sources
//
// Returns LogSource[] for a given project. The 404 is handled by the caller
// (e.g. when the project itself is not found) — no global toast.
// ---------------------------------------------------------------------------

export function useProjectLogSources(projectId: string) {
  return useQuery<LogSource[]>({
    queryKey: queryKeys.logSources.byProject(projectId),
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<LogSource>>(
        `/api/v1/projects/${projectId}/log-sources`,
        { schema: PaginatedResponseSchema(LogSourceSchema) },
      );
      return response.data.data;
    },
    enabled: Boolean(projectId),
  });
}
