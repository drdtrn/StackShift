import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/app/lib/api-client';
import { AlertRuleSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import type { AlertRule } from '@/app/types';

export function useAlertRules(projectId: string | null | undefined) {
  return useQuery<AlertRule[]>({
    queryKey: queryKeys.alertRules.list(projectId ?? ''),
    queryFn: async () => {
      const response = await apiClient.get<AlertRule[]>('/api/v1/alert-rules', {
        params: { projectId },
        schema: z.array(AlertRuleSchema),
      });
      return response.data;
    },
    enabled: Boolean(projectId),
  });
}
