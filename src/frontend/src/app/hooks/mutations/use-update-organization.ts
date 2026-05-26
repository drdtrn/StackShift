'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { OrganizationSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import { useApiError } from '@/app/hooks/useApiError';
import { useToastStore } from '@/app/hooks/useToastStore';
import type { Organization } from '@/app/types';

interface UpdateOrganizationInput {
  id: string;
  name: string;
  logoUrl: string | null;
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const handleApiError = useApiError();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<Organization, AxiosError, UpdateOrganizationInput>({
    mutationFn: async ({ id, name, logoUrl }) => {
      const response = await apiClient.put<Organization>(
        `/api/v1/organizations/${id}`,
        { name, logoUrl },
        { schema: OrganizationSchema },
      );
      return response.data;
    },
    onSuccess: async (organization) => {
      queryClient.setQueryData(queryKeys.organizations.current(), organization);
      await queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
      addToast({ variant: 'success', message: 'Organization updated.' });
    },
    onError: handleApiError,
  });
}
