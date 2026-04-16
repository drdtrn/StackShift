import { type NextRequest, NextResponse } from 'next/server';

/**
 * Route proxy (Next.js 16 replacement for middleware.ts).
 *
 * Next.js 16 renamed `middleware.ts` → `proxy.ts` and the exported function
 * from `middleware()` → `proxy()`. The proxy runs on the Node.js runtime
 * (Edge runtime is no longer supported here).
 *
 * Current state (FE-05 stub): allows all requests through.
 *
 * Final implementation (BE-03 — Keycloak auth integration):
 *   1. Read the session cookie / Bearer token from the request.
 *   2. Verify the JWT against Keycloak's JWKS endpoint.
 *   3. If unauthenticated and the path matches the dashboard matcher,
 *      redirect to /login with `?next=<original path>` for post-login redirect.
 *   4. If authenticated and the path is /login or /callback, redirect to /.
 *
 * The matcher below excludes:
 *   - Next.js internals (_next/static, _next/image)
 *   - Favicon
 *   - Auth routes (/login, /callback) — so unauthenticated users can reach them
 *
 * All dashboard routes (/, /logs, /incidents, /alerts, /projects, /settings)
 * fall through the matcher and will be protected once step 3 is implemented.
 */
export function proxy(_request: NextRequest) {
  // Stub: pass all requests through unchanged.
  // Replace this with auth check in BE-03.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *   - _next/static  (static chunks)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - stacksifticon.png
     *   - /login        (auth — must be public)
     *   - /callback     (auth — must be public)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|stacksifticon\\.png|login|callback).*)',
  ],
};
