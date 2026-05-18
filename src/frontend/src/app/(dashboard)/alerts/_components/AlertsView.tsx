'use client';

import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { useAlerts } from '@/app/hooks/queries/use-alerts';
import { useAcknowledgeAlert } from '@/app/hooks/mutations/use-acknowledge-alert';
import { useApiError } from '@/app/hooks/useApiError';
import { DataTable } from '@/app/components/ui/DataTable';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import type { Alert, AlertSeverity } from '@/app/types';
import type { AlertStatus } from '@/app/hooks/queries/use-alerts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_VARIANT: Record<AlertSeverity, 'critical' | 'high' | 'medium' | 'low'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// AcknowledgeButton — tiny wrapper so the hook can be called at component level
// ---------------------------------------------------------------------------

function AcknowledgeButton({ alert, projectId }: { alert: Alert; projectId?: string }) {
  const { acknowledge, isPending } = useAcknowledgeAlert(projectId);
  const isAcknowledged = Boolean(alert.acknowledgedAt);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isAcknowledged || isPending}
      onClick={() => acknowledge(alert.id)}
      className="text-xs"
    >
      {isAcknowledged ? 'Acknowledged' : 'Acknowledge'}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// AlertsView
// ---------------------------------------------------------------------------

export function AlertsView() {
  const handleApiError = useApiError();

  const [statusFilter, setStatusFilter] = useState<AlertStatus | ''>('');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | ''>('');

  const { data: alerts, isLoading, isError, error } = useAlerts({
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
  });

  if (isError) handleApiError(error);

  const columns = useMemo<ColumnDef<Alert, unknown>[]>(
    () => [
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => (
          <Badge variant={SEVERITY_VARIANT[row.original.severity]}>
            {row.original.severity}
          </Badge>
        ),
        size: 100,
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {row.original.title}
          </span>
        ),
      },
      {
        accessorKey: 'firedAt',
        header: 'Fired at',
        cell: ({ row }) => (
          <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
            {formatDateTime(row.original.firedAt)}
          </span>
        ),
        size: 160,
      },
      {
        accessorKey: 'acknowledgedAt',
        header: 'Acknowledged',
        cell: ({ row }) => {
          const v = row.original.acknowledgedAt;
          return v ? (
            <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
              {formatDateTime(v)}
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          );
        },
        size: 160,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => <AcknowledgeButton alert={row.original} />,
        size: 130,
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="mt-1 text-sm text-zinc-400">Active and recent alerts across all projects.</p>
        </div>
        <Link
          href="/alerts/new"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          New rule
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AlertStatus | '')}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">All statuses</option>
            <option value="fired">Fired</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Severity
          </label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | '')}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={alerts ?? []}
        loading={isLoading}
        emptyState={{
          title: 'No alerts',
          description: statusFilter || severityFilter
            ? 'No alerts match the selected filters.'
            : 'No alerts have fired yet.',
        }}
        estimatedRowHeight={48}
        height={500}
      />
    </div>
  );
}
