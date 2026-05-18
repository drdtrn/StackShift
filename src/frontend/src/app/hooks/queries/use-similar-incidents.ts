'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { SimilarIncidentSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import type { SimilarIncident } from '@/app/types';

// ---------------------------------------------------------------------------
// useSimilarIncidents — top-3 semantically similar past incidents
//
// GET /api/v1/incidents/{id}/similar → SimilarIncident[]
// score is cosine similarity (0-1). UI displays as (score * 100)%.
// Disabled when incidentId is empty.
// ---------------------------------------------------------------------------

export function useSimilarIncidents(incidentId: string) {
  return useQuery<SimilarIncident[], AxiosError>({
    queryKey: queryKeys.incidents.similar(incidentId),
    queryFn: async () => {
      const response = await apiClient.get<SimilarIncident[]>(
        `/api/v1/incidents/${incidentId}/similar`,
        { schema: z.array(SimilarIncidentSchema) },
      );
      return response.data;
    },
    enabled: Boolean(incidentId),
    staleTime: 60_000, // similarity scores don't change often
  });
}
