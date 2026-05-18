'use client';

import { Badge } from '@/app/components/ui/Badge';
import type { BadgeProps } from '@/app/components/ui/Badge';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { EmptyState } from '@/app/components/ui/EmptyState';
import type { Alert, AlertSeverity } from '@/app/types';

// ---------------------------------------------------------------------------
// Severity → badge variant
// ---------------------------------------------------------------------------

const SEVERITY_VARIANT: Record<AlertSeverity, BadgeProps['variant']> = {
  low:      'neutral',
  medium:   'medium',
  high:     'high',
  critical: 'critical',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// AlertCard
// ---------------------------------------------------------------------------

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-surface p-4">
      {/* Timeline connector dot */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-500/20" />
        <div className="flex-1 w-px bg-line mt-1" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={SEVERITY_VARIANT[alert.severity]} size="sm" className="capitalize">
            {alert.severity}
          </Badge>
          <span className="text-xs text-muted tabular-nums">{formatDate(alert.firedAt)}</span>
          {alert.acknowledgedAt && (
            <span className="text-xs text-green-400">✓ ack {formatDate(alert.acknowledgedAt)}</span>
          )}
        </div>
        <p className="text-sm font-medium">{alert.title}</p>
        <p className="text-xs text-muted leading-relaxed">{alert.description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AlertsTimeline
// ---------------------------------------------------------------------------

export interface AlertsTimelineProps {
  alerts: Alert[];
  isLoading?: boolean;
}

export function AlertsTimeline({ alerts, isLoading }: AlertsTimelineProps) {
  // Sort by firedAt descending (most recent first)
  const sorted = [...alerts].sort(
    (a, b) => new Date(b.firedAt).getTime() - new Date(a.firedAt).getTime(),
  );

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Contributing Alerts</h2>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <EmptyState
          title="No contributing alerts"
          description="No alerts are linked to this incident."
        />
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="flex flex-col gap-0">
          {sorted.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
