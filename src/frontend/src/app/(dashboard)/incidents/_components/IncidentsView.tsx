'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import type { BadgeProps } from '@/app/components/ui/Badge';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { useIncidents } from '@/app/hooks/queries/use-incidents';
import { useUIStore } from '@/app/hooks/useUIStore';
import { cn } from '@/app/lib/utils';
import type { AlertSeverity, Incident, IncidentStatus } from '@/app/types';

// ---------------------------------------------------------------------------
// Badge variant maps
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<IncidentStatus, BadgeProps['variant']> = {
  open:         'high',
  acknowledged: 'medium',
  resolved:     'info',
  closed:       'neutral',
};

const SEVERITY_VARIANT: Record<AlertSeverity, BadgeProps['variant']> = {
  low:      'neutral',
  medium:   'medium',
  high:     'high',
  critical: 'critical',
};

// ---------------------------------------------------------------------------
// Status filter tabs
// ---------------------------------------------------------------------------

const STATUS_FILTERS = [
  { label: 'All',          value: undefined          as IncidentStatus | undefined },
  { label: 'Open',         value: 'open'             as IncidentStatus },
  { label: 'Acknowledged', value: 'acknowledged'     as IncidentStatus },
  { label: 'Resolved',     value: 'resolved'         as IncidentStatus },
  { label: 'Closed',       value: 'closed'           as IncidentStatus },
];

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// IncidentRow
// ---------------------------------------------------------------------------

function IncidentRow({ incident }: { incident: Incident }) {
  return (
    <tr className="border-b border-line hover:bg-elevated transition-colors">
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[incident.status]} className="capitalize">
          {incident.status}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={SEVERITY_VARIANT[incident.severity]} className="capitalize">
          {incident.severity}
        </Badge>
      </td>
      <td className="px-4 py-3 max-w-xs">
        <Link
          href={`/incidents/${incident.id}`}
          className="text-sm text-primary hover:text-blue-400 hover:underline line-clamp-2"
        >
          {incident.title}
        </Link>
      </td>
      <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
        {formatDate(incident.startedAt)}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/incidents/${incident.id}`}
          className="text-xs text-blue-400 hover:underline"
          aria-label={`View incident: ${incident.title}`}
        >
          View →
        </Link>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// IncidentsView
// ---------------------------------------------------------------------------

export function IncidentsView() {
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const activeProjectId = useUIStore((s) => s.activeProjectId);

  const { data, isLoading, isError } = useIncidents({
    projectId: activeProjectId ?? undefined,
    status: statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  const incidents = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const handleStatusChange = (status: IncidentStatus | undefined) => {
    setStatusFilter(status);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Status filter tabs */}
      <div className="flex items-center gap-1 flex-wrap" role="tablist" aria-label="Filter by status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            role="tab"
            aria-selected={statusFilter === f.value}
            onClick={() => handleStatusChange(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-elevated text-muted hover:text-primary',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-line overflow-hidden">
        {isLoading && (
          <div className="p-4 flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        )}

        {isError && (
          <div className="p-8 text-center text-sm text-zinc-400">
            Failed to load incidents. Check your connection and try again.
          </div>
        )}

        {!isLoading && !isError && incidents.length === 0 && (
          <EmptyState
            title="No incidents found"
            description={
              statusFilter
                ? `No ${statusFilter} incidents. Try a different filter.`
                : 'No incidents have been recorded yet.'
            }
          />
        )}

        {!isLoading && !isError && incidents.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-xs text-muted font-medium">
                <th className="px-4 py-2.5 text-left w-32">Status</th>
                <th className="px-4 py-2.5 text-left w-24">Severity</th>
                <th className="px-4 py-2.5 text-left">Title</th>
                <th className="px-4 py-2.5 text-left w-40">Started</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <IncidentRow key={incident.id} incident={incident} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>{total} incidents</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
