'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Server, Globe, Database, Network, Box } from 'lucide-react';
import { ApiKeyRevealModal } from '@/app/components/dialogs/ApiKeyRevealModal';
import { useProject } from '@/app/hooks/queries/use-projects';
import { useProjectLogSources } from '@/app/hooks/queries/use-project-log-sources';
import { useCreateLogSource } from '@/app/hooks/mutations/use-log-sources';
import { useApiError } from '@/app/hooks/useApiError';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { Card, CardBody } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Modal } from '@/app/components/ui/Modal';
import type { LogSource, LogSourceCreated, LogSourceType } from '@/app/types';

// ---------------------------------------------------------------------------
// Log source type icon mapping
// ---------------------------------------------------------------------------

const LOG_SOURCE_ICONS: Record<LogSource['type'], React.ReactNode> = {
  application: <Globe className="h-4 w-4" aria-hidden="true" />,
  server: <Server className="h-4 w-4" aria-hidden="true" />,
  database: <Database className="h-4 w-4" aria-hidden="true" />,
  network: <Network className="h-4 w-4" aria-hidden="true" />,
  custom: <Box className="h-4 w-4" aria-hidden="true" />,
};

// ---------------------------------------------------------------------------
// LogSourceRow
// ---------------------------------------------------------------------------

function LogSourceRow({ source }: { source: LogSource }) {
  return (
    <Link
      href={`/log-sources/${source.id}`}
      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      <div className="flex items-center gap-3">
        <span className="text-zinc-400">{LOG_SOURCE_ICONS[source.type]}</span>
        <div>
          <p className="text-sm font-medium">{source.name}</p>
          <p className="text-xs text-zinc-500 font-mono">{source.keyPrefix}***************************</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={source.isActive ? 'info' : 'neutral'}>
          {source.isActive ? 'Active' : 'Inactive'}
        </Badge>
        {source.lastSeenAt && (
          <span className="hidden text-xs text-zinc-400 sm:inline">
            Last seen {new Date(source.lastSeenAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// ProjectDetailView — client component that owns all data-fetching
// ---------------------------------------------------------------------------

interface ProjectDetailViewProps {
  projectId: string;
}

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const router = useRouter();
  const handleApiError = useApiError();
  const [addOpen, setAddOpen] = useState(false);
  const [createdSource, setCreatedSource] = useState<LogSourceCreated | null>(null);
  const createLogSource = useCreateLogSource();

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    error: projectErr,
  } = useProject(projectId);

  const {
    data: logSources,
    isLoading: sourcesLoading,
    isError: sourcesError,
    error: sourcesErr,
  } = useProjectLogSources(projectId);

  if (projectError) handleApiError(projectErr);
  if (sourcesError) handleApiError(sourcesErr);

  // --- Loading skeleton ---
  if (projectLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-4 w-72" />
        <div className="flex gap-4">
          <Skeleton className="h-20 w-32 rounded-lg" />
          <Skeleton className="h-20 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  // --- 404 / cross-tenant masking ---
  if (!project) {
    return (
      <EmptyState
        icon={<Box className="h-12 w-12" aria-hidden="true" />}
        title="Project not found"
        description="This project does not exist or you do not have access to it."
        cta={{ label: 'Back to Projects', onClick: () => history.back() }}
        className="min-h-[300px] rounded-lg border border-zinc-200 dark:border-zinc-800"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
            aria-hidden="true"
          />
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Project</p>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-zinc-400">{project.description}</p>
            )}
          </div>
        </div>
        <Link
          href="/projects/new"
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          New project
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardBody className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Log Sources</p>
            <p className="text-3xl font-bold tabular-nums">{project.logSourceCount}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Active Incidents</p>
            <p className="text-3xl font-bold tabular-nums">{project.activeIncidentCount}</p>
          </CardBody>
        </Card>
      </div>

      {/* Log sources section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Log Sources</h2>
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add log source
          </Button>
        </div>

        {sourcesLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!sourcesLoading && (!logSources || logSources.length === 0) && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No log sources configured for this project.</p>
          </div>
        )}

        {!sourcesLoading && logSources && logSources.length > 0 && (
          <div className="flex flex-col gap-2">
            {logSources.map((source) => (
              <LogSourceRow key={source.id} source={source} />
            ))}
          </div>
        )}
      </div>

      <AddLogSourceDialog
        open={addOpen}
        loading={createLogSource.isPending}
        onClose={() => setAddOpen(false)}
        onSubmit={(input) => {
          createLogSource.mutate(
            { projectId, ...input },
            {
              onSuccess: (created) => {
                setAddOpen(false);
                setCreatedSource(created);
              },
            },
          );
        }}
      />

      {createdSource && (
        <ApiKeyRevealModal
          open
          apiKey={createdSource.apiKey}
          keyPrefix={createdSource.logSource.keyPrefix}
          onConfirmed={() => {
            const id = createdSource.logSource.id;
            setCreatedSource(null);
            router.push(`/log-sources/${id}`);
          }}
        />
      )}
    </div>
  );
}

function AddLogSourceDialog({
  open,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; type: LogSourceType }) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<LogSourceType>('application');

  return (
    <Modal open={open} onClose={onClose} title="Add log source" size="sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ name, type });
        }}
      >
        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          required
        />
        <fieldset className="grid grid-cols-2 gap-2">
          {(['application', 'server', 'database', 'network', 'custom'] as const).map((item) => (
            <label
              key={item}
              className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <input
                type="radio"
                name="log-source-type"
                value={item}
                checked={type === item}
                onChange={() => setType(item)}
              />
              <span className="capitalize">{item}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={name.trim().length < 2}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
