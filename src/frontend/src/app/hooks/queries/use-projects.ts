import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { MOCK_PROJECTS } from '@/app/lib/mock-data';
import type { Project } from '@/app/types';

// ---------------------------------------------------------------------------
// Simulated network delay
//
// Wrapping mock data in a 300ms delay makes loading states (Skeleton
// components) actually render during development. Swap the queryFn body
// with a real apiClient.get() call when the backend is ready.
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// useProjects — list all projects in the active organisation
// ---------------------------------------------------------------------------

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: queryKeys.projects.list(),
    queryFn: async () => {
      await delay(300);
      return MOCK_PROJECTS;
    },
  });
}

// ---------------------------------------------------------------------------
// useProject — single project by ID
// ---------------------------------------------------------------------------

export function useProject(id: string) {
  return useQuery<Project>({
    queryKey: queryKeys.projects.detail(id),
    queryFn: async () => {
      await delay(300);
      const project = MOCK_PROJECTS.find((p) => p.id === id);
      if (!project) throw new Error(`Project not found: ${id}`);
      return project;
    },
    enabled: Boolean(id),
  });
}
