'use client';

import { useAccountExports } from '@/app/hooks/queries/use-account-exports';
import { useRequestAccountExport } from '@/app/hooks/mutations/use-request-account-export';
import { Button } from '@/app/components/ui/Button';
import { Card, CardBody } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Skeleton';
import type { AccountExportStatus } from '@/app/lib/account-schemas';

const STATUS_LABELS: Record<AccountExportStatus, string> = {
  Pending: 'Building…',
  Ready: 'Ready',
  Failed: 'Failed',
  Expired: 'Expired',
};

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function AccountDataPanel() {
  const list = useAccountExports();
  const request = useRequestAccountExport();

  const hasPending = list.data?.some((row) => row.status === 'Pending') ?? false;
  const mostRecent = list.data?.find((row) => row.status === 'Ready');
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentReadyBlocks =
    mostRecent != null && new Date(mostRecent.requestedAt).getTime() > sevenDaysAgo;

  const buttonDisabled = list.isPending || hasPending || recentReadyBlocks || request.isPending;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Export your data</h2>
          <p className="text-sm text-muted">
            Request a copy of every record StackSift holds about you. Your bundle
            includes profile, organisations, projects, alerts, incidents, AI
            analyses, and audit events. Downloads are signed for 24 hours after
            the build completes.
          </p>
          <p className="text-xs text-muted">
            Limit: one completed export per 7 days.
          </p>
          <div>
            <Button
              type="button"
              disabled={buttonDisabled}
              onClick={() => request.mutate()}
            >
              {request.isPending ? 'Requesting…' : 'Request data export'}
            </Button>
          </div>
          {hasPending ? (
            <p className="text-xs text-muted">
              An export is currently being built — refresh in a few moments.
            </p>
          ) : null}
          {!hasPending && recentReadyBlocks ? (
            <p className="text-xs text-muted">
              You can request a new export 7 days after your last one. Most
              recent: {formatDate(mostRecent?.requestedAt ?? null)}.
            </p>
          ) : null}
          {request.isError ? (
            <p className="text-sm text-red-500">
              Could not start the export. Refresh and try again.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Past exports</h2>
          {list.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 rounded" />
              <Skeleton className="h-10 rounded" />
            </div>
          ) : list.isError ? (
            <p className="text-sm text-red-500">Could not load past exports.</p>
          ) : list.data && list.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {list.data.map((row) => (
                <li
                  key={row.requestId}
                  className="flex flex-col gap-1 rounded border border-zinc-200 dark:border-zinc-800 p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {STATUS_LABELS[row.status]}
                    </span>
                    <span className="text-xs text-muted">
                      requested {formatDate(row.requestedAt)}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    {row.completedAt
                      ? `completed ${formatDate(row.completedAt)} • ${formatBytes(row.sizeBytes)}`
                      : 'not yet completed'}
                  </div>
                  {row.status === 'Ready' && row.signedUrl ? (
                    <a
                      href={row.signedUrl}
                      className="text-sm text-blue-500 hover:underline"
                    >
                      Download .zip (expires {formatDate(row.expiresAt)})
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No exports yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
