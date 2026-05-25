'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { AddOrInviteMemberResultSchema, MemberSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import { useApiError } from '@/app/hooks/useApiError';
import { useToastStore } from '@/app/hooks/useToastStore';
import type {
  AddOrInviteMemberResult,
  Member,
  UserRole,
} from '@/app/types';

interface AddOrInviteVars {
  email: string;
  role: UserRole;
}

export function useAddOrInviteMember(orgId: string | null | undefined) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const handleApiError = useApiError();

  return useMutation<AddOrInviteMemberResult, AxiosError, AddOrInviteVars>({
    mutationFn: async (vars) => {
      if (!orgId) throw new Error('orgId required');
      const response = await apiClient.post<AddOrInviteMemberResult>(
        `/api/v1/organizations/${orgId}/members`,
        vars,
        { schema: AddOrInviteMemberResultSchema },
      );
      return response.data;
    },
    onSuccess: (result) => {
      if (result.member) {
        addToast({
          variant: 'success',
          message: `Added ${result.member.email} as ${result.member.role}.`,
        });
      } else if (result.invitation) {
        addToast({
          variant: 'success',
          message: `Invitation sent to ${result.invitation.email}.`,
        });
      }
    },
    onError: handleApiError,
    onSettled: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.members.byOrg(orgId) });
      }
    },
  });
}

interface UpdateRoleVars {
  userId: string;
  newRole: UserRole;
}

interface UpdateRoleContext {
  previous: Member[] | undefined;
}

export function useUpdateMemberRole(orgId: string | null | undefined) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const handleApiError = useApiError();

  return useMutation<Member, AxiosError, UpdateRoleVars, UpdateRoleContext>({
    mutationFn: async ({ userId, newRole }) => {
      if (!orgId) throw new Error('orgId required');
      const response = await apiClient.patch<Member>(
        `/api/v1/organizations/${orgId}/members/${userId}`,
        { role: newRole },
        { schema: MemberSchema },
      );
      return response.data;
    },
    onMutate: async ({ userId, newRole }) => {
      if (!orgId) return { previous: undefined };
      const key = queryKeys.members.byOrg(orgId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Member[]>(key);
      if (previous) {
        queryClient.setQueryData<Member[]>(
          key,
          previous.map((m) => (m.id === userId ? { ...m, role: newRole } : m)),
        );
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (orgId && context?.previous) {
        queryClient.setQueryData(queryKeys.members.byOrg(orgId), context.previous);
      }
      handleApiError(error);
    },
    onSuccess: (member) => {
      addToast({
        variant: 'success',
        message: `${member.displayName}'s role is now ${member.role}.`,
      });
    },
    onSettled: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.members.byOrg(orgId) });
      }
    },
  });
}

interface RemoveVars {
  userId: string;
}

interface RemoveContext {
  previous: Member[] | undefined;
}

export function useRemoveMember(orgId: string | null | undefined) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const handleApiError = useApiError();

  return useMutation<void, AxiosError, RemoveVars, RemoveContext>({
    mutationFn: async ({ userId }) => {
      if (!orgId) throw new Error('orgId required');
      await apiClient.delete(`/api/v1/organizations/${orgId}/members/${userId}`);
    },
    onMutate: async ({ userId }) => {
      if (!orgId) return { previous: undefined };
      const key = queryKeys.members.byOrg(orgId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Member[]>(key);
      if (previous) {
        queryClient.setQueryData<Member[]>(
          key,
          previous.filter((m) => m.id !== userId),
        );
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (orgId && context?.previous) {
        queryClient.setQueryData(queryKeys.members.byOrg(orgId), context.previous);
      }
      handleApiError(error);
    },
    onSuccess: () => {
      addToast({ variant: 'success', message: 'Member removed.' });
    },
    onSettled: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.members.byOrg(orgId) });
      }
    },
  });
}
