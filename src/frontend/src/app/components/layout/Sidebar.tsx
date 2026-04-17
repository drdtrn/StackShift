'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  Flame,
  Bell,
  Server,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useSession } from '@/app/hooks/useSession';
import { useUIStore } from '@/app/hooks/useUIStore';
import { MOCK_ORGANIZATIONS } from '@/app/lib/mock-data';

// ---------------------------------------------------------------------------
// Nav item definitions
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/logs', label: 'Log Explorer', icon: Search },
  { href: '/incidents', label: 'Incidents', icon: Flame },
  { href: '/alerts', label: 'Alert Rules', icon: Bell },
  { href: '/projects', label: 'Projects', icon: Server },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the organisation name for the given org ID by looking up the mock
 * data. Returns '—' if not found (e.g. during onboarding before org is set).
 *
 * When the real backend is wired, this will be replaced by a useOrganisation()
 * query hook that calls GET /api/organisations/:id.
 */
function getOrganisationName(orgId: string | null): string {
  if (!orgId) return '—';
  return MOCK_ORGANIZATIONS.find((o) => o.id === orgId)?.name ?? '—';
}

/**
 * Returns true if the nav item's href matches the current pathname.
 * Uses exact match for `/` (Overview) and prefix match for all others,
 * so `/incidents/inc-001` still highlights the "Incidents" nav item.
 */
function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SidebarProps {
  /** Whether the sidebar is collapsed to icon-only width. */
  collapsed: boolean;
  /** Called when the user clicks the collapse/expand toggle button. */
  onToggle: () => void;
  /**
   * When true, hides the collapse toggle button and adapts the layout for
   * the mobile drawer context (full-width, no toggle needed).
   */
  isMobile?: boolean;
  /**
   * Optional click handler for nav links. In the mobile drawer, this is used
   * to close the drawer when a link is clicked.
   */
  onNavClick?: () => void;
}

// ---------------------------------------------------------------------------
// Sidebar
//
// The persistent navigation panel rendered on the left side of every
// (dashboard) route. Two widths:
//   - Expanded (default): w-56 — icon + label + org name
//   - Collapsed: w-16 — icon only (label visually hidden, tooltip on hover)
//
// State:
//   - `collapsed` / `onToggle` are props driven by AppShell which reads
//     useUIStore. The Sidebar itself is stateless — it just renders.
//
// Active highlighting:
//   - Tailwind classes applied via `isActive()` utility.
//   - Left border indicator (`border-l-2 border-blue-500`) for the active item.
// ---------------------------------------------------------------------------

export function Sidebar({ collapsed, onToggle, isMobile = false, onNavClick }: SidebarProps) {
  const pathname = usePathname() ?? '/';
  const { user } = useSession();
  const theme = useUIStore((state) => state.theme);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      setResolvedTheme('dark');
      return;
    }

    if (theme === 'light') {
      setResolvedTheme('light');
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setResolvedTheme(event.matches ? 'dark' : 'light');
    };

    setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const logoSrc =
    resolvedTheme === 'dark'
      ? '/namestacksiftwhiteicon.png'
      : '/namestacksifticon.png';

  const orgName = getOrganisationName(user?.organizationId ?? null);

  return (
    <aside
      className="flex h-full flex-col bg-surface border-r border-line"
      aria-label="Main navigation"
    >
      {/* ── Logo + Org Name ─────────────────────────────────────────────── */}
      <div className="px-3 pt-4 pb-3 border-b border-line shrink-0">
        <Link
          href="/"
          onClick={onNavClick}
          className="flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="StackSift home"
        >
          <Image
            src="/stacksifticon.png"
            alt="StackSift logo"
            width={32}
            height={32}
            className="h-10 w-auto shrink-0 rounded"
          />
          {!collapsed && (
            <Image
              src={logoSrc}
              alt="StackSift wordmark"
              width={120}
              height={28}
              className="h-5 w-auto shrink-0"
            />
          )}
        </Link>
        {/* Org name — hidden when collapsed */}
        {!collapsed && (
          <p className="mt-1.5 px-1 text-xs text-muted truncate" title={orgName}>
            {orgName}
          </p>
        )}
      </div>

      {/* ── Nav Links ────────────────────────────────────────────────────── */}
      <nav className="flex flex-col gap-0.5 px-2 py-3 flex-1" aria-label="App sections">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              title={collapsed ? label : undefined}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-2.5 rounded-md py-2 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                collapsed ? 'justify-center px-2' : 'px-3',
                active
                  ? 'bg-elevated text-primary border-l-2 border-blue-500'
                  : 'text-muted hover:bg-elevated/60 hover:text-primary border-l-2 border-transparent',
              )}
            >
              <Icon
                className={cn(
                  'shrink-0',
                  collapsed ? 'h-5 w-5' : 'h-4 w-4',
                  active ? 'text-blue-400' : 'text-muted group-hover:text-primary',
                )}
                aria-hidden="true"
              />
              {!collapsed && (
                <span className="truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Collapse Toggle (desktop only) ──────────────────────────────── */}
      {!isMobile && (
        <div className="px-2 pb-2 shrink-0">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex w-full items-center rounded-md px-3 py-2 text-xs text-muted',
              'transition-colors hover:bg-elevated hover:text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              collapsed ? 'justify-center' : 'gap-2',
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}

    </aside>
  );
}
