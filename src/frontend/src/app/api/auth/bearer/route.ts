import { type NextRequest, NextResponse } from 'next/server';
import {
  readSessionCookie,
  isSessionExpired,
  refreshSession,
  createSessionCookie,
  clearSessionCookie,
} from '@/app/lib/auth/session';

// ---------------------------------------------------------------------------
// GET /api/auth/bearer
//
// Returns the session access_token as { token: string } so the Axios client
// can attach it as `Authorization: Bearer <token>` without ever exposing the
// HTTP-only session cookie to JavaScript.
//
// Mirrors /api/auth/token but uses the key name the apiClient expects.
// Handles silent token refresh: if the access_token is expired, it exchanges
// the refresh_token with Keycloak (or mock) before responding. On failed
// refresh (refresh_token expired/revoked) the session cookie is cleared and
// 401 is returned — apiClient will then redirect to /login.
//
// Cache: no-store — never stash a JWT in a CDN or browser cache.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = readSessionCookie(request);

  if (!session) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!isSessionExpired(session)) {
    return NextResponse.json(
      { token: session.accessToken },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const refreshed = await refreshSession(session);

  if (!refreshed) {
    const response = NextResponse.json(
      { error: 'session_expired' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
    response.headers.append('Set-Cookie', clearSessionCookie());
    return response;
  }

  const response = NextResponse.json(
    { token: refreshed.accessToken },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
  response.headers.append('Set-Cookie', createSessionCookie(refreshed));
  return response;
}
