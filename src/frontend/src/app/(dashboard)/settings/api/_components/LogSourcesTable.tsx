'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { useOrganizationLogSources } from '@/app/hooks/queries/use-organization-log-sources';
import { useProjects } from '@/app/hooks/queries/use-projects';
import type { LogSource } from '@/app/types';

export function LogSourcesTable() {
  const sources = useOrganizationLogSources();
  const projects = useProjects();

  if (sources.isLoading || projects.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const projectNames = new Map((projects.data ?? []).map((project) => [project.id, project.name]));
  const rows = [...(sources.data ?? [])].sort(compareLastUsedDesc);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">API</h1>
        <p className="mt-1 text-sm text-zinc-500">Log source keys and integration entry points.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Source name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Key prefix</th>
              <th className="px-4 py-3 font-medium">Last used</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((source) => (
              <tr key={source.id}>
                <td className="px-4 py-3">{projectNames.get(source.projectId) ?? source.projectId.slice(0, 8)}</td>
                <td className="px-4 py-3 font-medium">{source.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="neutral" size="sm">{source.type}</Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{source.keyPrefix}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {source.keyLastUsedAt ? relativeTime(source.keyLastUsedAt) : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/log-sources/${source.id}`}
                    className="inline-flex h-8 items-center gap-2 rounded-md bg-zinc-100 px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-zinc-500" colSpan={6}>
                  No log sources configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function compareLastUsedDesc(a: LogSource, b: LogSource) {
  const aTime = a.keyLastUsedAt ? new Date(a.keyLastUsedAt).getTime() : 0;
  const bTime = b.keyLastUsedAt ? new Date(b.keyLastUsedAt).getTime() : 0;
  return bTime - aTime;
}

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}
