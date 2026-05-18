import type { LogQueryFilters } from '@/app/types';

// ---------------------------------------------------------------------------
// Query Key Factory
//
// A centralized, type-safe object that generates stable query key arrays.
// Using an object factory (vs. raw string arrays) means:
//   1. All keys for a given domain live in one place.
//   2. `queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })`
//      correctly invalidates ALL project queries (list + detail) because
//      TanStack Query matches by key prefix.
//   3. TypeScript enforces argument shapes at every call-site.
// ---------------------------------------------------------------------------

export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: () => [...queryKeys.projects.lists()] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
  },

  logs: {
    all: ['logs'] as const,
    lists: () => [...queryKeys.logs.all, 'list'] as const,
    list: (filters?: LogQueryFilters) =>
      [...queryKeys.logs.lists(), { filters }] as const,
    details: () => [...queryKeys.logs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.logs.details(), id] as const,
  },

  incidents: {
    all: ['incidents'] as const,
    lists: () => [...queryKeys.incidents.all, 'list'] as const,
    list: (projectId?: string) =>
      [...queryKeys.incidents.lists(), { projectId }] as const,
    details: () => [...queryKeys.incidents.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.incidents.details(), id] as const,
  },

  alerts: {
    all: ['alerts'] as const,
    lists: () => [...queryKeys.alerts.all, 'list'] as const,
    list: (projectId?: string) =>
      [...queryKeys.alerts.lists(), { projectId }] as const,
    details: () => [...queryKeys.alerts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.alerts.details(), id] as const,
  },
} as const;
