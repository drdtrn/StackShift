'use client';

import { useRouter } from 'next/navigation';
import { FolderOpen } from 'lucide-react';
import { useProjects } from '@/app/hooks/queries/use-projects';
import { useDashboardStats } from '@/app/hooks/queries/use-dashboard-stats';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Card, CardBody } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { UpgradeBanner } from '@/app/components/layout/UpgradeBanner';

interface MetricCardProps {
  label: string;
  value: number | string;
  loading?: boolean;
}

function MetricCard({ label, value, loading }: MetricCardProps) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        {loading ? (
          <Skeleton className="h-9 w-16 rounded-md" />
        ) : (
          <p className="text-3xl font-bold tabular-nums">{value}</p>
        )}
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const projects = useProjects();
  const stats = useDashboardStats();

  const noProjects = projects.data !== undefined && projects.data.length === 0;
  const hasProjects = projects.data !== undefined && projects.data.length > 0;

  // Em-dash for empty-org branch keeps "you haven't connected anything yet"
  // distinct from "you're connected and there are zero incidents".
  const showValue = !noProjects && stats.data !== undefined;
  const displayAlert = showValue ? stats.data!.activeAlertCount : noProjects ? '—' : '';
  const displayLogs = showValue ? stats.data!.totalLogsToday : noProjects ? '—' : '';
  const displayIncidents = showValue ? stats.data!.openIncidentCount : noProjects ? '—' : '';
  const loadingMetrics = !noProjects && stats.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Active alerts, log ingestion, and open incidents.
        </p>
      </div>

      <UpgradeBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Active Alerts" value={displayAlert} loading={loadingMetrics} />
        <MetricCard label="Total Logs Today" value={displayLogs} loading={loadingMetrics} />
        <MetricCard label="Open Incidents" value={displayIncidents} loading={loadingMetrics} />
      </div>

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
          </p>
        </div>
      )}
    </div>
  );
}
