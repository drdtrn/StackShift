'use client';

import { Badge } from '@/app/components/ui/Badge';
import type { BadgeProps } from '@/app/components/ui/Badge';
import { cn } from '@/app/lib/utils';
import type { AlertSeverity, Incident, IncidentStatus } from '@/app/types';

// ---------------------------------------------------------------------------
// Badge variant maps
// ---------------------------------------------------------------------------

export const STATUS_VARIANT: Record<IncidentStatus, BadgeProps['variant']> = {
  open:         'high',
  acknowledged: 'medium',
  resolved:     'info',
  closed:       'neutral',
};

export const SEVERITY_VARIANT: Record<AlertSeverity, BadgeProps['variant']> = {
  low:      'neutral',
  medium:   'medium',
  high:     'high',
  critical: 'critical',
};

// ---------------------------------------------------------------------------
// Status transition guard
//
// Valid transitions: Open → Acknowledged → Resolved → Closed
// Buttons are visible for all applicable next states; non-applicable ones
// are disabled so the SRE understands the state machine.
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled: boolean;
  isPending: boolean;
  variant?: 'primary' | 'danger';
}

function ActionButton({ label, onClick, disabled, isPending, variant = 'primary' }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isPending}
      className={cn(
        'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'danger'
          ? 'bg-red-600/20 border border-red-600 text-red-400 hover:bg-red-600/30'
          : 'bg-blue-600 text-white hover:bg-blue-700',
        (disabled || isPending) && 'hover:bg-blue-600',
      )}
    >
      {isPending ? 'Updating…' : label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// IncidentHeader
// ---------------------------------------------------------------------------

export interface IncidentHeaderProps {
  incident: Incident;
  onUpdateStatus: (status: IncidentStatus) => void;
  isUpdating: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function IncidentHeader({ incident, onUpdateStatus, isUpdating }: IncidentHeaderProps) {
  const { status } = incident;

  return (
    <div className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-4">
      {/* Top row: breadcrumb-style metadata */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={STATUS_VARIANT[status]} className="capitalize">{status}</Badge>
        <Badge variant={SEVERITY_VARIANT[incident.severity]} className="capitalize">
          {incident.severity}
        </Badge>
        <span className="text-xs text-muted">Started {formatDate(incident.startedAt)}</span>
        {incident.acknowledgedAt && (
          <span className="text-xs text-muted">
            · Acknowledged {formatDate(incident.acknowledgedAt)}
          </span>
        )}
        {incident.resolvedAt && (
          <span className="text-xs text-muted">
            · Resolved {formatDate(incident.resolvedAt)}
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-xl font-semibold leading-snug">{incident.title}</h1>

      {/* Description */}
      {incident.description && (
        <p className="text-sm text-muted leading-relaxed">{incident.description}</p>
      )}

      {/* Action buttons — only shown for non-terminal statuses */}
      {status !== 'closed' && (
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {/* Acknowledge — active only when open */}
          <ActionButton
            label="Acknowledge"
            onClick={() => onUpdateStatus('acknowledged')}
            disabled={status !== 'open'}
            isPending={isUpdating}
          />

          {/* Resolve — active only when acknowledged; disabled (visible) when open */}
          <ActionButton
            label="Resolve"
            onClick={() => onUpdateStatus('resolved')}
            disabled={status !== 'acknowledged'}
            isPending={isUpdating}
          />

          {/* Close — active only when resolved */}
          {status === 'resolved' && (
            <ActionButton
              label="Close incident"
              onClick={() => onUpdateStatus('closed')}
              disabled={false}
              isPending={isUpdating}
              variant="danger"
            />
          )}
        </div>
      )}
    </div>
  );
}
