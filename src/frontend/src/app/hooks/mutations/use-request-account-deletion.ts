'use client';

import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import {
  AccountDeletionAcceptedSchema,
  type AccountDeletionAccepted,
} from '@/app/lib/account-schemas';

export function useRequestAccountDeletion() {
  return useMutation<AccountDeletionAccepted, AxiosError, string>({
    mutationFn: async (confirmation: string) => {
      const response = await apiClient.delete('/api/v1/account', {
        data: { confirmation },
        schema: AccountDeletionAcceptedSchema,
      });
      return response.data;
    },
  });
}
