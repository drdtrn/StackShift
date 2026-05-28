import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import { LogSourceSchema } from '@/app/lib/api-schemas';
import type { LogSource } from '@/app/types';

export function useOrganizationLogSources() {
  return useQuery<LogSource[]>({
    queryKey: queryKeys.logSources.organization(),
    queryFn: async () => {
      const response = await apiClient.get<LogSource[]>(
        '/api/v1/log-sources',
        { schema: z.array(LogSourceSchema) },
      );
      return response.data;
    },
  });
}
