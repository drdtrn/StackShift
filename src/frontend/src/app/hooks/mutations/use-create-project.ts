'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useToastStore } from '@/app/hooks/useToastStore';
import { queryKeys } from '@/app/lib/query-keys';
import type { ProjectFormInput } from '@/app/lib/schemas/project';
import type { Project } from '@/app/types';

// ---------------------------------------------------------------------------
// useCreateProject
//
// TanStack Query mutation hook for the New Project Wizard (US-08).
//
// Mutation type signature: useMutation<TData, TError, TVars>
//   TData  = Project       — what the server returns on success
//   TError = Error         — what we throw on failure
//   TVars  = ProjectFormInput — what the caller passes to mutate()
//
// Flow:
//   POST /api/projects with the wizard's form data
//     ├── 201 → show success toast, invalidate project list, redirect
//     └── 4xx → show error toast
//
// WHY invalidate queryKeys.projects.all?
//   The projects list page (useProjects hook) caches data under
//   queryKeys.projects.list(). By invalidating the parent key
//   queryKeys.projects.all (which is ['projects']), TanStack Query marks ALL
//   project queries stale and refetches them. The new project will appear in
//   the list immediately after the redirect. Without invalidation, the list
//   would show cached data and miss the new entry until the next stale check.
//
// WHY redirect to /projects/:id (not /projects)?
//   After creation, users want to immediately configure their new project.
//   The project detail page is where they add team members, view the API key,
//   and check log sources. Redirecting to the list would force an extra click.
// ---------------------------------------------------------------------------

export function useCreateProject() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);

  const mutation = useMutation<Project, Error, ProjectFormInput>({
    mutationFn: async (input) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error ?? 'create_project_failed');
      }

      return res.json() as Promise<Project>;
    },

    onSuccess: async (project) => {
      // Invalidate project list so the new project shows up on /projects.
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

      addToast({
        variant: 'success',
        message: `Project "${project.name}" created successfully.`,
      });

      router.push(`/projects/${project.id}`);
    },

    onError: (err) => {
      addToast({
        variant: 'error',
        message: err.message === 'unauthenticated'
          ? 'Your session expired. Please log in again.'
          : 'Failed to create project. Please try again.',
      });
    },
  });

  return {
    createProject: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
