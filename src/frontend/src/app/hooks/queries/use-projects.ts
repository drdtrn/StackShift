import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import { ApiResponseSchema, PaginatedResponseSchema, ProjectSchema } from '@/app/lib/api-schemas';
import type { Project, PaginatedResponse, ApiResponse } from '@/app/types';

// ---------------------------------------------------------------------------
// useProjects — list all projects in the active organisation (offset-paginated)
//
// Returns Project[] (extracted from PaginatedResponse) so callers don't need
// to know about the envelope. The full paginated response is available via
// useProjectsPaginated() if pagination controls are needed.
// ---------------------------------------------------------------------------

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: queryKeys.projects.list(),
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Project>>('/api/v1/projects', {
        params: { page: 1, pageSize: 50 },
        schema: PaginatedResponseSchema(ProjectSchema),
      });
      return response.data.data;
    },
  });
}

// ---------------------------------------------------------------------------
// useProject — single project by ID
//
// GET /api/v1/projects/{id} → ApiResponse<Project>
// Returns 404 when the project doesn't belong to the caller's org (cross-tenant
// masking). The 404 is NOT toasted globally — the caller renders an empty state.
// ---------------------------------------------------------------------------

export function useProject(id: string) {
  return useQuery<Project>({
    queryKey: queryKeys.projects.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Project>>(`/api/v1/projects/${id}`, {
        schema: ApiResponseSchema(ProjectSchema),
      });
      return response.data.data;
    },
    enabled: Boolean(id),
  });
}
