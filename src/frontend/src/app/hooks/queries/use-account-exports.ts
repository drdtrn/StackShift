'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/app/lib/api-client';
import { queryKeys } from '@/app/lib/query-keys';
import {
  AccountExportRequestListSchema,
  type AccountExportRequest,
} from '@/app/lib/account-schemas';

export function useAccountExports() {
  return useQuery<AccountExportRequest[]>({
    queryKey: queryKeys.account.exportRequests(),
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/account/export-requests', {
        schema: AccountExportRequestListSchema,
      });
      return response.data;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}
