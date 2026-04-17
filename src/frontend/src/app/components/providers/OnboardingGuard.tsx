'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/app/hooks/useSession';

// ---------------------------------------------------------------------------
// OnboardingGuard
//
// Client-side wrapper used in (dashboard)/layout.tsx, nested inside
// <AuthGuard>. AuthGuard has already guaranteed the user is authenticated
// by the time OnboardingGuard runs. This guard's sole job is to check
// whether the authenticated user has an organisation.
//
// Three states:
//   1. Loading (isLoading=true): render children — AuthGuard's loading
//      overlay is already shown, so no duplicate spinner is needed here.
//   2. No organisation (user.organizationId === null): redirect to
//      /onboarding so the user can create their org before accessing the
//      dashboard.
//   3. Has organisation: render children as normal.
//
// WHY a separate component from AuthGuard?
//   Single Responsibility Principle — AuthGuard owns "are you logged in?",
//   OnboardingGuard owns "do you have an org?". This keeps each guard
//   testable independently and makes the nesting intent explicit in the
//   layout JSX.
//
// Nesting order in (dashboard)/layout.tsx:
//   <AuthGuard>          ← must authenticate first
//     <OnboardingGuard>  ← then check org
//       {children}
//     </OnboardingGuard>
//   </AuthGuard>
// ---------------------------------------------------------------------------

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user !== null && user.organizationId === null) {
      router.push('/onboarding');
    }
  }, [isLoading, user, router]);

  // While loading: children are already behind AuthGuard's overlay.
  // If no org: redirect is in progress — return null to avoid dashboard flash.
  if (!isLoading && user !== null && user.organizationId === null) {
    return null;
  }

  return <>{children}</>;
}
