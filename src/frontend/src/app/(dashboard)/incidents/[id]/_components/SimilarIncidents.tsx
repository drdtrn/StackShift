'use client';

import Link from 'next/link';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { cn } from '@/app/lib/utils';
import type { SimilarIncident } from '@/app/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function scoreColour(score: number): string {
  if (score >= 0.8) return 'text-green-400';
  if (score >= 0.5) return 'text-amber-400';
  return 'text-zinc-400';
}

// ---------------------------------------------------------------------------
// SimilarIncidents
// ---------------------------------------------------------------------------

export interface SimilarIncidentsProps {
  items: SimilarIncident[];
  isLoading?: boolean;
}

export function SimilarIncidents({ items, isLoading }: SimilarIncidentsProps) {
  // Show top-3 only
  const top = items.slice(0, 3);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Similar Past Incidents</h2>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && top.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted text-center">
          No similar incidents found yet.
        </div>
      )}

      {!isLoading && top.length > 0 && (
        <div className="flex flex-col gap-2">
          {top.map(({ incident, score }) => {
            const pct = Math.round(score * 100);
            return (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-4 hover:bg-elevated transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn('text-xs font-semibold tabular-nums', scoreColour(score))}
                    title={`${pct}% similar`}
                  >
                    {pct}% match
                  </span>
                  <span className="text-xs text-muted">{formatDate(incident.startedAt)}</span>
                </div>
                <p className="text-sm line-clamp-2 leading-snug">{incident.title}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
