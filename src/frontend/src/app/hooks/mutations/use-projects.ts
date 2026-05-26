'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { ProjectSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import { useApiError } from '@/app/hooks/useApiError';
import { useToastStore } from '@/app/hooks/useToastStore';
import { useUIStore } from '@/app/hooks/useUIStore';
import type { Project } from '@/app/types';

export interface UpdateProjectInput {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const handleApiError = useApiError();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<Project, AxiosError, UpdateProjectInput>({
    mutationFn: async ({ id, name, description, color }) => {
      const response = await apiClient.put<Project>(
        `/api/v1/projects/${id}`,
        { name, description, color },
        { schema: ProjectSchema },
      );
      return response.data;
    },
    onSuccess: async (project) => {
      queryClient.setQueryData(queryKeys.projects.detail(project.id), project);
      queryClient.setQueryData<Project[]>(queryKeys.projects.list(), (previous) =>
        previous?.map((item) => (item.id === project.id ? project : item)),
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      addToast({ variant: 'success', message: `Project "${project.name}" updated.` });
    },
    onError: handleApiError,
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const handleApiError = useApiError();
  const addToast = useToastStore((s) => s.addToast);
  const activeProjectId = useUIStore((s) => s.activeProjectId);
  const setActiveProject = useUIStore((s) => s.setActiveProject);

  return useMutation<void, AxiosError, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`/api/v1/projects/${id}`);
    },
    onSuccess: async (_result, id) => {
      if (activeProjectId === id) {
        setActiveProject(null);
      }
      queryClient.setQueryData<Project[]>(queryKeys.projects.list(), (previous) =>
        previous?.filter((project) => project.id !== id),
      );
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      addToast({ variant: 'success', message: 'Project deleted.' });
    },
    onError: handleApiError,
  });
}
