import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import { LogSourceSchema } from '@/app/lib/api-schemas';
import type { LogSource } from '@/app/types';

export function useLogSource(id: string) {
  return useQuery<LogSource>({
    queryKey: queryKeys.logSources.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<LogSource>(
        `/api/v1/log-sources/${id}`,
        { schema: LogSourceSchema },
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}
