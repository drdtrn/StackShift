'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import { useApiError } from '@/app/hooks/useApiError';
import { useToastStore } from '@/app/hooks/useToastStore';
import type { ProjectFormInput } from '@/app/lib/schemas/project';
import type { Project, ApiResponse } from '@/app/types';

// ---------------------------------------------------------------------------
// Optimistic update context — snapshot of the projects list before mutation.
// If the POST fails we roll back to this value.
// ---------------------------------------------------------------------------

interface MutationContext {
  previousProjects: Project[] | undefined;
}

// ---------------------------------------------------------------------------
// useCreateProject
//
// Posts to the real backend (POST /api/v1/projects) instead of the local
// Next.js mock route handler (which has been deleted).
//
// Mutation generics (4 params, required by TanStack Query v5 for optimistic):
//   TData     = ApiResponse<Project>   what the server returns
//   TError    = AxiosError             what the client interceptor throws
//   TVars     = ProjectFormInput       what the caller passes to mutate()
//   TContext  = MutationContext        snapshot for rollback on failure
//
// Optimistic update flow:
//   1. onMutate  — cancel in-flight refetches, snapshot list, add temp project
//   2. onError   — roll back to snapshot; useApiError() handles the toast
//   3. onSuccess — show success toast, redirect to the new project's detail page
//   4. onSettled — always invalidate ['projects'] so the list re-syncs with BE
// ---------------------------------------------------------------------------

export function useCreateProject() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const handleApiError = useApiError();

  const mutation = useMutation<ApiResponse<Project>, AxiosError, ProjectFormInput, MutationContext>({
    mutationFn: async (input) => {
      const response = await apiClient.post<ApiResponse<Project>>('/api/v1/projects', input);
      return response.data;
    },

    onMutate: async (input) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update.
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });

      const previousProjects = queryClient.getQueryData<Project[]>(queryKeys.projects.list());

      // Optimistically prepend a temporary project entry.
      if (previousProjects) {
        const optimistic: Project = {
          id: `optimistic-${Date.now()}`,
          organizationId: '',
          name: input.name,
          slug: input.name.toLowerCase().replace(/\s+/g, '-'),
          description: input.description ?? null,
          color: '#6366f1',
          logSourceCount: 1,
          activeIncidentCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<Project[]>(queryKeys.projects.list(), [
          optimistic,
          ...previousProjects,
        ]);
      }

      return { previousProjects };
    },

    onError: (err, _vars, context) => {
      // Roll back the optimistic entry.
      if (context?.previousProjects !== undefined) {
        queryClient.setQueryData(queryKeys.projects.list(), context.previousProjects);
      }
      handleApiError(err);
    },

    onSuccess: async (response) => {
      const project = response.data;
      addToast({
        variant: 'success',
        message: `Project "${project.name}" created successfully.`,
      });
      // Invalidate before redirect to prevent stale-cache redirect loops.
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      router.push(`/projects/${project.id}`);
    },

    onSettled: () => {
      // Always re-sync with the server regardless of success/failure.
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });

  return {
    createProject: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
