'use client';

import { useRouter } from 'next/navigation';
import { FolderOpen } from 'lucide-react';
import { useProjects } from '@/app/hooks/queries/use-projects';
import { useApiError } from '@/app/hooks/useApiError';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { ProjectCard } from './ProjectCard';

export function ProjectsList() {
  const router = useRouter();
  const { data: projects, isLoading, isError, error } = useProjects();
  const handleApiError = useApiError();

  if (isError) {
    handleApiError(error);
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="mt-auto h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen className="h-12 w-12" aria-hidden="true" />}
        title="No projects yet"
        description="Create your first project to start ingesting logs and monitoring your services."
        cta={{
          label: 'Create Project',
          onClick: () => router.push('/projects/new'),
        }}
        className="min-h-[300px] rounded-lg border border-zinc-200 dark:border-zinc-800"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
