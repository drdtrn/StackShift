'use client';

import { useProjects } from '@/app/hooks/queries/use-projects';
import { useDashboardStats } from '@/app/hooks/queries/use-dashboard-stats';
import { Card, CardBody } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { UpgradeBanner } from '@/app/components/layout/UpgradeBanner';
import { useCurrentOrganization } from '@/app/hooks/queries/use-organization';
import { useSubscription } from '@/app/hooks/queries/use-subscription';

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
  const organization = useCurrentOrganization();
  const projects = useProjects();
  const stats = useDashboardStats();
  const subscription = useSubscription();

  const noProjects = projects.data !== undefined && projects.data.length === 0;
  const hasProjects = projects.data !== undefined && projects.data.length > 0;
  const projectCount = projects.data?.length ?? 0;
  const plan = subscription.data?.plan ?? organization.data?.plan;

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Organization
            </p>
            <p className="mt-2 text-lg font-semibold">
              {organization.data?.name ?? 'Organization'}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {organization.data?.slug ?? 'Loading organization details'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Plan
            </p>
            <p className="mt-2 text-lg font-semibold capitalize">{plan ?? '-'}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {subscription.data?.status ?? 'Subscription status loading'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Projects
            </p>
            <p className="mt-2 text-lg font-semibold tabular-nums">{projectCount}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {projectCount === 1 ? '1 monitored project' : `${projectCount} monitored projects`}
            </p>
          </CardBody>
        </Card>
      </div>

      {noProjects && (
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold">No monitored projects</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Your organization is set up, but no projects are connected yet. Use the Projects section to add monitored services.
            </p>
          </CardBody>
        </Card>
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
