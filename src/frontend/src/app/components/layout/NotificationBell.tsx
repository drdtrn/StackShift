'use client';

import { Bell } from 'lucide-react';

// ---------------------------------------------------------------------------
// NotificationBell
//
// A bell icon button with an unread-count badge.
// Currently a stub — count is always 0 from TopBar.
// Sprint 3: connect to useAlertNotifications() SignalR hook for real count.
// ---------------------------------------------------------------------------

interface NotificationBellProps {
  /** Number of unread notifications. Badge is hidden when 0. */
  count?: number;
}

export function NotificationBell({ count = 0 }: NotificationBellProps) {
  return (
    <button
      type="button"
      aria-label={`Notifications (${count} unread)`}
      className="relative rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />

      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
