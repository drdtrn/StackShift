'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/app/lib/utils';
import { useAuthStore } from '@/app/hooks/useAuthStore';

const BASE_TABS = [
  { href: '/settings', label: 'General' },
  { href: '/settings/billing', label: 'Billing' },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const tabs = role === 'owner'
    ? [...BASE_TABS, { href: '/settings/members', label: 'Members' }]
    : BASE_TABS;

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800" aria-label="Settings sections">
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  active
                    ? 'border-blue-500 text-primary'
                    : 'border-transparent text-muted hover:text-primary hover:border-zinc-300 dark:hover:border-zinc-700',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
