'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/hooks/useAuthStore';

// OrgGuard runs after AuthGuard inside (dashboard)/layout.tsx. AuthGuard has
// already guaranteed the user is authenticated. OrgGuard decides where the
// user belongs based on (role, organizationId):
//
//   State A — has org, on a regular dashboard route   → render children
//   State A/D — has org, on /onboarding or /waiting   → push them out to /
//   State B — owner without org                       → push to /onboarding
//   State C — non-owner without org                   → push to /waiting
//
// The client-side guard is the mid-session fix: when /waiting polls and the
// refetched user has organizationId set, the store update triggers this
// effect and bumps the user to /. The (dashboard)/layout.tsx server-side
// redirect handles cold visits without flicker.

export function OrgGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const onOnboarding = pathname.startsWith('/onboarding');
    const onWaiting = pathname.startsWith('/waiting');

    if (user.organizationId) {
      if (onOnboarding || onWaiting) router.replace('/');
      return;
    }

    if (user.role === 'owner') {
      if (!onOnboarding) router.replace('/onboarding');
    } else {
      if (!onWaiting) router.replace('/waiting');
    }
  }, [user, pathname, router]);

  return <>{children}</>;
}
