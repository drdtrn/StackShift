'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/app/hooks/useUIStore';
import { useProjects } from '@/app/hooks/queries/use-projects';

export function useActiveProjectBootstrap(): void {
  const activeProjectId = useUIStore((s) => s.activeProjectId);
  const setActiveProject = useUIStore((s) => s.setActiveProject);
  const { data } = useProjects();

  useEffect(() => {
    if (activeProjectId) return;
    const first = data?.[0];
    if (first?.id) setActiveProject(first.id);
  }, [activeProjectId, data, setActiveProject]);
}
