'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { queryKeys } from '@/app/lib/query-keys';
import {
  AccountExportRequestSchema,
  type AccountExportRequest,
} from '@/app/lib/account-schemas';

export function useRequestAccountExport() {
  const qc = useQueryClient();
  return useMutation<AccountExportRequest, AxiosError>({
    mutationFn: async () => {
      const response = await apiClient.post(
        '/api/v1/account/export-requests',
        null,
        { schema: AccountExportRequestSchema },
      );
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.account.exportRequests() });
    },
  });
}
