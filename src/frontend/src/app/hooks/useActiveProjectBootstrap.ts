'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/app/hooks/useUIStore';
import { useProjects } from '@/app/hooks/queries/use-projects';

export function useActiveProjectBootstrap(): void {
  const activeProjectId = useUIStore((s) => s.activeProjectId);
  const setActiveProject = useUIStore((s) => s.setActiveProject);
  const { data } = useProjects();

  useEffect(() => {
    if (!data) return;

    if (data.length === 0) {
      if (activeProjectId) setActiveProject(null);
      return;
    }

    if (!activeProjectId || !data.some((project) => project.id === activeProjectId)) {
      setActiveProject(data[0].id);
    }
  }, [activeProjectId, data, setActiveProject]);
}
