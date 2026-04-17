'use client';

import { useRouter } from 'next/navigation';
import { FolderOpen } from 'lucide-react';
import { useProjects } from '@/app/hooks/queries/use-projects';
import { useAlerts } from '@/app/hooks/queries/use-alerts';
import { useIncidents } from '@/app/hooks/queries/use-incidents';
import { useLogEntries } from '@/app/hooks/queries';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Card, CardBody } from '@/app/components/ui/Card';

// ---------------------------------------------------------------------------
// Metric card shape
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: number | string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Overview page
//
// US-04: Shows an EmptyState when no projects exist (org was just created in
// US-03). When projects are present, shows real metric counts derived from
// TanStack Query hooks that back the mock data layer.
//
// This is a Client Component because it calls TanStack Query hooks.
// The browser tab title ("Dashboard — StackSift") is set by the parent
// (dashboard)/layout.tsx metadata export — which remains a Server Component.
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const projects = useProjects();
  const alerts = useAlerts();
  const incidents = useIncidents();
  const logs = useLogEntries();

  // ----- Derived metric values -----

  // Active alerts: those with no resolvedAt timestamp
  const activeAlertCount = alerts.data
    ? alerts.data.filter((a) => a.resolvedAt === null).length
    : null;

  // Logs today: all log entries (production will filter server-side by date)
  const logCountToday = logs.data ? logs.data.data.length : null;

  // Open incidents: open or acknowledged (not resolved/closed)
  const openIncidentCount = incidents.data
    ? incidents.data.filter((i) => i.status === 'open' || i.status === 'acknowledged').length
    : null;

  const hasProjects = projects.data !== undefined && projects.data.length > 0;
  const noProjects = projects.data !== undefined && projects.data.length === 0;

  // When no projects exist, metric counts are meaningless — show em-dash.
  // When loading (data undefined), also show em-dash (loading.tsx handled skeleton phase).
  const displayAlert = noProjects || activeAlertCount === null ? '—' : activeAlertCount;
  const displayLogs = noProjects || logCountToday === null ? '—' : logCountToday;
  const displayIncidents = noProjects || openIncidentCount === null ? '—' : openIncidentCount;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Active alerts, log ingestion, and open incidents.
        </p>
      </div>

      {/* Summary metric cards — always rendered, show '—' when no projects */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Active Alerts" value={displayAlert} />
        <MetricCard label="Total Logs Today" value={displayLogs} />
        <MetricCard label="Open Incidents" value={displayIncidents} />
      </div>

      {/* Content area: empty state when no projects, otherwise future panels */}
      {noProjects && (
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
      )}

      {hasProjects && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <p className="text-sm text-zinc-500">
            {projects.data!.length} project{projects.data!.length !== 1 ? 's' : ''} connected.
            Detailed analytics coming in Sprint 2.
          </p>
        </div>
      )}
    </div>
  );
}
