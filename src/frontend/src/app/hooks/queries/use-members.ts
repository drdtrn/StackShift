import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/app/lib/api-client';
import { MemberSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import type { Member } from '@/app/types';

const MemberListSchema = z.array(MemberSchema);

export function useMembers(orgId: string | null | undefined) {
  return useQuery<Member[]>({
    queryKey: orgId ? queryKeys.members.byOrg(orgId) : ['members', 'inactive'],
    queryFn: async () => {
      const response = await apiClient.get<Member[]>(
        `/api/v1/organizations/${orgId}/members`,
        { schema: MemberListSchema },
      );
      return response.data;
    },
    enabled: Boolean(orgId),
  });
}
