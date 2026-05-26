import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import {
  PaginatedResponseSchema,
  IncidentSchema,
  AlertSchema,
} from '@/app/lib/api-schemas';
import type {
  Alert,
  Incident,
  IncidentFilters,
  PaginatedResponse,
} from '@/app/types';

// ---------------------------------------------------------------------------
// useIncidents — paginated incident list with optional status + project filter
//
// GET /api/v1/incidents?page=1&pageSize=20&status=open&projectId=...
// ---------------------------------------------------------------------------

export function useIncidents(filters: IncidentFilters = {}) {
  return useQuery<PaginatedResponse<Incident>, AxiosError>({
    queryKey: queryKeys.incidents.list(filters),
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20,
      };
      if (filters.projectId) params.projectId = filters.projectId;
      if (filters.status) params.status = filters.status;

      const response = await apiClient.get<PaginatedResponse<Incident>>(
        '/api/v1/incidents',
        { schema: PaginatedResponseSchema(IncidentSchema), params },
      );
      return response.data;
    },
  });
}

// ---------------------------------------------------------------------------
// useIncident — single incident by ID
//
// GET /api/v1/incidents/{id} → Incident
// ---------------------------------------------------------------------------

export function useIncident(id: string) {
  return useQuery<Incident, AxiosError>({
    queryKey: queryKeys.incidents.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<Incident>(
        `/api/v1/incidents/${id}`,
        { schema: IncidentSchema },
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// useIncidentAlerts — alerts that belong to a specific incident
//
// GET /api/v1/alerts?incidentId={id}&pageSize=50
// ---------------------------------------------------------------------------

export function useIncidentAlerts(incidentId: string) {
  return useQuery<Alert[], AxiosError>({
    queryKey: ['alerts', 'byIncident', incidentId],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Alert>>(
        '/api/v1/alerts',
        {
          schema: PaginatedResponseSchema(AlertSchema),
          params: { incidentId, pageSize: 50 },
        },
      );
      return response.data.data;
    },
    enabled: Boolean(incidentId),
  });
}
