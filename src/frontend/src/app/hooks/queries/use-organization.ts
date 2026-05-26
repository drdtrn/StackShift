import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/app/lib/api-client';
import { OrganizationSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import type { Organization } from '@/app/types';

export function useCurrentOrganization() {
  return useQuery<Organization>({
    queryKey: queryKeys.organizations.current(),
    queryFn: async () => {
      const response = await apiClient.get<Organization>('/api/v1/organizations/current', {
        schema: OrganizationSchema,
      });
      return response.data;
    },
    staleTime: 30_000,
  });
}
