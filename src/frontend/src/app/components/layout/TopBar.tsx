'use client';

import { Menu } from 'lucide-react';
import { useUIStore } from '@/app/hooks/useUIStore';
import { Breadcrumb } from './Breadcrumb';
import { OrgSwitcher } from './OrgSwitcher';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { UserAvatarMenu } from './UserAvatarMenu';

// ---------------------------------------------------------------------------
// TopBar
//
// Full-width header rendered above <main> in AppShell's right panel.
// sticky top-0 z-30 so it stays visible while content scrolls.
//
// Layout (left → right):
//   [☰ hamburger — md:hidden] [Breadcrumb — flex-1]
//   [OrgSwitcher — hidden md:inline-flex] [🔔] [🌙] [Avatar▾]
//
// The hamburger is md:hidden — on desktop the sidebar handles navigation.
// On mobile the hamburger opens the MobileDrawer.
// ---------------------------------------------------------------------------

export function TopBar() {
  const { toggleMobileDrawer } = useUIStore();

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4"
      aria-label="Application top bar"
    >
      {/* Left group: hamburger (mobile) + breadcrumb */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleMobileDrawer}
          aria-label="Open navigation menu"
          className="md:hidden shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 overflow-hidden">
          <Breadcrumb />
        </div>
      </div>

      {/* Right group: org switcher + notifications + theme + avatar */}
      <div className="flex shrink-0 items-center gap-1">
        <OrgSwitcher />
        <NotificationBell count={0} />
        <ThemeToggle />
        <UserAvatarMenu />
      </div>
    </header>
  );
}
