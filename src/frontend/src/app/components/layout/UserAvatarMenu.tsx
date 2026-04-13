'use client';

import { useRouter } from 'next/navigation';
import { User, Settings, LogOut } from 'lucide-react';
import { useSession } from '@/app/hooks/useSession';
import { useSignOut } from '@/app/hooks/useSignOut';
import { Dropdown } from '@/app/components/ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ---------------------------------------------------------------------------
// UserAvatarMenu
//
// Compact circular avatar in the TopBar. Clicking opens a dropdown with:
//   Profile (disabled label row — shows user name)
//   Settings → /settings
//   Sign Out → signOut()
//
// Replaces UserMenu at the bottom of the Sidebar (profile/sign-out moves here).
// ---------------------------------------------------------------------------

export function UserAvatarMenu() {
  const { user } = useSession();
  const { signOut, isLoading } = useSignOut();
  const router = useRouter();

  if (!user) return null;

  const initials = getInitials(user.displayName);

  const trigger = (
    <button
      type="button"
      aria-label={`Account menu for ${user.displayName}`}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    >
      {initials}
    </button>
  );

  return (
    <Dropdown
      trigger={trigger}
      align="right"
      items={[
        {
          id: 'profile',
          label: user.displayName,
          icon: <User className="h-4 w-4" aria-hidden="true" />,
          disabled: true,
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: <Settings className="h-4 w-4" aria-hidden="true" />,
        },
        {
          id: 'sign-out',
          label: isLoading ? 'Signing out…' : 'Sign out',
          icon: <LogOut className="h-4 w-4" aria-hidden="true" />,
          disabled: isLoading,
        },
      ]}
      onSelect={(id) => {
        if (id === 'settings') router.push('/settings');
        if (id === 'sign-out') signOut();
      }}
    />
  );
}
