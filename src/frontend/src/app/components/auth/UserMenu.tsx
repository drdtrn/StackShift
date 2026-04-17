'use client';

import { LogOut } from 'lucide-react';
import { useSession } from '@/app/hooks/useSession';
import { useSignOut } from '@/app/hooks/useSignOut';
import { Dropdown } from '@/app/components/ui/Dropdown';

// ---------------------------------------------------------------------------
// UserMenu
//
// Displays the authenticated user's identity at the bottom of the sidebar and
// provides the "Sign out" action via a Dropdown (FE-04 component).
//
// Layout:
//   ┌──────────────────────────┐
//   │  [A]  Alice Nguyen       │  ← avatar initials + name + email
//   │       alice@acme-corp.com│
//   └──────────────────────────┘
//        ▼ (dropdown on click)
//   ┌──────────────────────────┐
//   │  🚪  Sign out            │
//   └──────────────────────────┘
//
// WHY useSession() and not useAuthStore() directly:
//   useSession() returns the hydrated user from TanStack Query (backed by the
//   HTTP-only cookie via /api/auth/me). The Zustand store is a mirror of this.
//   Either would work, but useSession() is the canonical source of truth for
//   user identity — it will automatically re-check when the session expires.
//
// WHY Dropdown component (FE-04) instead of a custom menu:
//   The Dropdown already implements the full ARIA Menu Button pattern with
//   keyboard navigation (ArrowUp/Down, Enter, Escape, click-outside). Building
//   a custom menu here would duplicate that work and potentially miss
//   accessibility requirements.
//
// Avatar initials:
//   Takes the first character of displayName (uppercased). Falls back to "?"
//   if displayName is empty. No external avatar library — just a div with
//   bg-blue-600 and the initial centred via flex.
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return first || '?';
}

export function UserMenu() {
  const { user } = useSession();
  const { signOut, isLoading } = useSignOut();

  if (!user) return null;

  const initials = getInitials(user.displayName);

  const trigger = (
    <button
      type="button"
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      aria-label={`Account menu for ${user.displayName}`}
    >
      {/* Avatar */}
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white"
        aria-hidden="true"
      >
        {initials}
      </span>

      {/* Name + email */}
      <span className="flex min-w-0 flex-col text-left">
        <span className="truncate font-medium text-zinc-200 leading-tight">
          {user.displayName}
        </span>
        <span className="truncate text-xs text-zinc-500 leading-tight">
          {user.email}
        </span>
      </span>
    </button>
  );

  return (
    <div className="mt-auto border-t border-zinc-800 px-2 pt-2 pb-2">
      <Dropdown
        trigger={trigger}
        align="left"
        items={[
          {
            id: 'sign-out',
            label: isLoading ? 'Signing out…' : 'Sign out',
            icon: <LogOut className="h-4 w-4" aria-hidden="true" />,
            disabled: isLoading,
          },
        ]}
        onSelect={(id) => {
          if (id === 'sign-out') signOut();
        }}
      />
    </div>
  );
}
