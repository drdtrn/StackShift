'use client';

import { Bell } from 'lucide-react';
import { PulsingBadge } from '@/app/components/animation/PulsingBadge';

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
      className="relative rounded-md p-1.5 text-muted transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />

      <PulsingBadge count={count} className="absolute -top-0.5 -right-0.5" />
    </button>
  );
}
