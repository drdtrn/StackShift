import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import { PaginatedResponseSchema, AlertSchema } from '@/app/lib/api-schemas';
import type { Alert, AlertSeverity } from '@/app/types';
import type { PaginatedResponse } from '@/app/types';

// ---------------------------------------------------------------------------
// AlertFilters
// ---------------------------------------------------------------------------

export type AlertStatus = 'fired' | 'acknowledged' | 'resolved';

export interface AlertFilters {
  status?: AlertStatus;
  severity?: AlertSeverity;
  projectId?: string;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// useAlerts — list alerts with optional status/severity/project filters
//
// GET /api/v1/alerts?status=fired&severity=high&projectId=...&page=1&pageSize=50
// ---------------------------------------------------------------------------

export function useAlerts(filters: AlertFilters = {}) {
  const { status, severity, projectId, page = 1, pageSize = 50 } = filters;

  return useQuery<Alert[]>({
    queryKey: queryKeys.alerts.list(projectId),
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (status) params.status = status;
      if (severity) params.severity = severity;
      if (projectId) params.projectId = projectId;

      const response = await apiClient.get<PaginatedResponse<Alert>>(
        '/api/v1/alerts',
        { params, schema: PaginatedResponseSchema(AlertSchema) },
      );
      return response.data.data;
    },
  });
}
