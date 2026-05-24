'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/app/hooks/useSession';

// ---------------------------------------------------------------------------
// AuthGuard
//
// Client-side wrapper used in (dashboard)/layout.tsx to protect all
// dashboard routes. Calls useSession() on mount to check authentication state.
//
// Three states:
//   1. Loading (isLoading=true): render children behind a full-page overlay
//      so there is no flash of unauthenticated content. The overlay also
//      prevents user interaction during the auth check.
//   2. Unauthenticated (isAuthenticated=false, isLoading=false): redirect to
//      /landing?next=<current path> so the user can register or sign in
//      and return to where they were trying to go.
//   3. Authenticated: render children as normal.
//
// WHY a client component in the layout (not middleware / proxy.ts)?
//   The proxy.ts stub currently lets all requests through. Full JWT
//   verification in the proxy requires crypto operations and the JWKS
//   endpoint — that's the DevOps + BE-03 task. AuthGuard provides a correct
//   client-side guard that works now without that infrastructure.
// ---------------------------------------------------------------------------

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const next = encodeURIComponent(pathname);
      router.push(`/landing?next=${next}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading) {
    return (
      <>
        {children}
        {/* Full-page loading overlay — prevents flash of unauthenticated content */}
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm"
          aria-busy="true"
          aria-label="Checking authentication…"
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-blue-500"
              role="status"
            />
            <p className="text-sm text-muted">Loading…</p>
          </div>
        </div>
      </>
    );
  }

  if (!isAuthenticated) {
    // Redirect is in progress via the useEffect above.
    // Return null so no dashboard content flashes before the redirect completes.
    return null;
  }

  return <>{children}</>;
}
