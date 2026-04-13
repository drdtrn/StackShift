'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/app/lib/utils';

// ---------------------------------------------------------------------------
// Route label map
// First-level route segments → human-readable labels.
// Dynamic segments (UUIDs, slugs) fall back to the raw segment text.
// ---------------------------------------------------------------------------

const ROUTE_LABELS: Record<string, string> = {
  '':          'Overview',
  'logs':      'Log Explorer',
  'incidents': 'Incidents',
  'alerts':    'Alert Rules',
  'projects':  'Projects',
  'settings':  'Settings',
  'new':       'New',
};

interface Crumb {
  label: string;
  href: string;
  isCurrent: boolean;
}

/**
 * Converts a pathname into an ordered array of breadcrumb objects.
 *
 * Example:
 *   '/incidents/inc-001' → [
 *     { label: 'Incidents', href: '/incidents', isCurrent: false },
 *     { label: 'inc-001',   href: '/incidents/inc-001', isCurrent: true },
 *   ]
 */
function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [{ label: 'Overview', href: '/', isCurrent: true }];
  }

  return segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = ROUTE_LABELS[segment] ?? segment;
    const isCurrent = index === segments.length - 1;
    return { label, href, isCurrent };
  });
}

// ---------------------------------------------------------------------------
// Breadcrumb component
// ---------------------------------------------------------------------------

export function Breadcrumb() {
  const pathname = usePathname() ?? '/';
  const crumbs = buildCrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center">
      <ol className="flex items-center gap-1">
        {crumbs.map((crumb, index) => (
          <li
            key={crumb.href}
            className={cn(
              'flex items-center gap-1',
              // On mobile: only show the last crumb (current page title)
              index < crumbs.length - 1 ? 'hidden md:flex' : 'flex',
            )}
          >
            {index > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 text-zinc-600 hidden md:block"
                aria-hidden="true"
              />
            )}

            {crumb.isCurrent ? (
              <span
                aria-current="page"
                className="text-sm font-medium text-zinc-100"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className={cn(
                  'text-sm text-zinc-400 hover:text-zinc-100 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded',
                )}
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
