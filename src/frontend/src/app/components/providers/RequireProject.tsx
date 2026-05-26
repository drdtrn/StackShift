'use client';

import { FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { EmptyState, Skeleton } from '@/app/components/ui';
import { useProjects } from '@/app/hooks/queries/use-projects';

export function RequireProject({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: projects, isLoading, isError } = useProjects();

  if (isLoading) {
    return <Skeleton shape="rectangle" height="28rem" className="w-full rounded-lg" />;
  }

  if (isError || !projects) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-sm text-muted">
        Could not load projects. Refresh the page to try again.
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen className="h-12 w-12" aria-hidden="true" />}
        title="Create a project first"
        description="Log Explorer, Incidents, and Alert Rules need a project to scope logs and alerts."
        cta={{
          label: 'Go to Projects',
          onClick: () => router.push('/projects'),
        }}
        className="min-h-[320px] rounded-lg border border-line"
      />
    );
  }

  return <>{children}</>;
}
