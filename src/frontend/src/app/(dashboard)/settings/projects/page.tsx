'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Skeleton, Textarea } from '@/app/components/ui';
import { useCurrentOrganization, useProjects } from '@/app/hooks/queries';
import { useDeleteProject, useUpdateProject } from '@/app/hooks/mutations';
import { useUIStore } from '@/app/hooks/useUIStore';
import type { Organization, Project } from '@/app/types';

const PLAN_PROJECT_LIMITS: Record<Organization['plan'], number | null> = {
  free: 1,
  indie: 5,
  team: null,
};

interface EditState {
  id: string;
  name: string;
  description: string;
  color: string;
}

function toEditState(project: Project): EditState {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? '',
    color: project.color,
  };
}

export default function SettingsProjectsPage() {
  const organization = useCurrentOrganization();
  const projects = useProjects();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const activeProjectId = useUIStore((s) => s.activeProjectId);
  const [editing, setEditing] = useState<EditState | null>(null);

  if (organization.isPending || projects.isPending) {
    return (
      <Card>
        <CardBody className="flex flex-col gap-3">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardBody>
      </Card>
    );
  }

  if (organization.isError || projects.isError || !organization.data) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-sm text-red-500">
        Could not load projects.
      </div>
    );
  }

  const projectList = projects.data ?? [];
  const projectLimit = PLAN_PROJECT_LIMITS[organization.data.plan];
  const canCreate = projectLimit === null || projectList.length < projectLimit;
  const limitLabel = projectLimit === null ? 'Unlimited projects' : `${projectList.length}/${projectLimit} projects`;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing?.name.trim()) return;
    updateProject.mutate(
      {
        id: editing.id,
        name: editing.name.trim(),
        description: editing.description.trim() ? editing.description.trim() : null,
        color: editing.color,
      },
      { onSuccess: () => setEditing(null) },
    );
  };

  const handleDelete = (project: Project) => {
    const confirmed = window.confirm(`Delete "${project.name}"? This cannot be undone.`);
    if (!confirmed) return;
    deleteProject.mutate(project.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Projects</h2>
            <p className="mt-1 text-sm text-muted">
              Manage the projects registered to {organization.data.name}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted">{limitLabel}</span>
            {canCreate ? (
              <Link
                href="/projects/new"
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                New project
              </Link>
            ) : (
              <Link
                href="/settings/billing"
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                Upgrade plan
              </Link>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {projectList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-elevated p-8 text-center text-sm text-muted">
              No projects have been created yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Usage</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {projectList.map((project) => (
                    <tr key={project.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <div>
                            <div className="font-medium text-primary">{project.name}</div>
                            <div className="text-xs text-muted">{project.description ?? 'No description'}</div>
                            {activeProjectId === project.id ? (
                              <div className="mt-1 text-xs font-medium text-blue-600">Active project</div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {project.logSourceCount} sources · {project.activeIncidentCount} active incidents
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(toEditState(project))}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(project)}
                            loading={deleteProject.isPending && deleteProject.variables === project.id}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {editing ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Edit project</h3>
          </CardHeader>
          <CardBody>
            <form className="flex max-w-2xl flex-col gap-4" onSubmit={handleSubmit}>
              <Input
                label="Project name"
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                minLength={3}
                maxLength={50}
                required
              />
              <Textarea
                label="Description"
                value={editing.description}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                maxLength={500}
              />
              <Input
                label="Color"
                type="color"
                value={editing.color}
                onChange={(event) => setEditing({ ...editing, color: event.target.value })}
                className="h-10 w-24 p-1"
              />
              <div className="flex gap-2">
                <Button type="submit" loading={updateProject.isPending} disabled={!editing.name.trim()}>
                  Save project
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
