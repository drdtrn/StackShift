'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Dropdown } from '@/app/components/ui';
import { useProjects } from '@/app/hooks/queries/use-projects';
import { useCurrentOrganization } from '@/app/hooks/queries/use-organization';
import { useSubscription } from '@/app/hooks/queries/use-subscription';
import { useUIStore } from '@/app/hooks/useUIStore';

export function OrgSwitcher() {
  const { data: organization } = useCurrentOrganization();
  const { data: projects = [] } = useProjects();
  const { data: subscription } = useSubscription();
  const activeProjectId = useUIStore((s) => s.activeProjectId);
  const setActiveProject = useUIStore((s) => s.setActiveProject);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const plan = subscription?.plan ?? organization?.plan;

  const trigger = (
    <button
      type="button"
      className="hidden max-w-[22rem] md:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-primary transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      aria-label="Current organization and project"
    >
      <span className="max-w-[9rem] truncate font-medium">
        {organization?.name ?? 'Organization'}
      </span>
      {activeProject ? (
        <span className="max-w-[9rem] truncate text-muted">/ {activeProject.name}</span>
      ) : null}
      {plan ? (
        <span className="rounded bg-elevated px-1.5 py-0.5 text-xs capitalize text-muted">
          {plan}
        </span>
      ) : null}
      <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
    </button>
  );

  const items = projects.length > 0
    ? projects.map((project) => ({
        id: project.id,
        label: project.name,
        icon: project.id === activeProject?.id
          ? <Check className="h-4 w-4 text-blue-500" aria-hidden="true" />
          : <span className="h-4 w-4" aria-hidden="true" />,
      }))
    : [{ id: 'no-projects', label: 'No projects', disabled: true }];

  return (
    <Dropdown
      trigger={trigger}
      align="left"
      items={items}
      onSelect={(projectId) => setActiveProject(projectId)}
    />
  );
}
