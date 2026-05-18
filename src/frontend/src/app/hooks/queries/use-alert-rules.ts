import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import { PaginatedResponseSchema, AlertRuleSchema } from '@/app/lib/api-schemas';
import type { AlertRule } from '@/app/types';
import type { PaginatedResponse } from '@/app/types';

// ---------------------------------------------------------------------------
// useAlertRules — list alert rules, optionally filtered by projectId
//
// GET /api/v1/alert-rules?projectId=...&page=1&pageSize=50
// ---------------------------------------------------------------------------

export function useAlertRules(projectId?: string) {
  return useQuery<AlertRule[]>({
    queryKey: queryKeys.alertRules.list(projectId),
    queryFn: async () => {
      const params: Record<string, string | number> = { page: 1, pageSize: 50 };
      if (projectId) params.projectId = projectId;

      const response = await apiClient.get<PaginatedResponse<AlertRule>>(
        '/api/v1/alert-rules',
        { params, schema: PaginatedResponseSchema(AlertRuleSchema) },
      );
      return response.data.data;
    },
  });
}
