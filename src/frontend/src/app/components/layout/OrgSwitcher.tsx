'use client';

import { ChevronDown } from 'lucide-react';
import { Dropdown } from '@/app/components/ui';
import { MOCK_ORGANIZATIONS } from '@/app/lib/mock-data';
import { useSession } from '@/app/hooks/useSession';

// ---------------------------------------------------------------------------
// OrgSwitcher
//
// Displays the current organisation name and allows switching between orgs.
// Hidden on mobile — the sidebar drawer shows the org name there instead.
//
// Stub: selecting a different org only logs to console.
// Future: call useAuthStore().setOrganization() and invalidate all queries.
// ---------------------------------------------------------------------------

export function OrgSwitcher() {
  const { user } = useSession();

  const currentOrg =
    MOCK_ORGANIZATIONS.find((o) => o.id === user?.organizationId) ??
    MOCK_ORGANIZATIONS[0];

  const trigger = (
    <button
      type="button"
      className="hidden md:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      aria-label={`Current organisation: ${currentOrg.name}. Click to switch.`}
    >
      <span className="font-medium">{currentOrg.name}</span>
      <ChevronDown className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
    </button>
  );

  const items = MOCK_ORGANIZATIONS.map((org) => ({
    id: org.id,
    label: org.name,
  }));

  return (
    <Dropdown
      trigger={trigger}
      align="left"
      items={items}
      onSelect={(id) => {
        const selected = MOCK_ORGANIZATIONS.find((o) => o.id === id);
        console.log('[OrgSwitcher] switched to:', selected?.name);
      }}
    />
  );
}
