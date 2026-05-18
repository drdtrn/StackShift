import { type NextRequest, NextResponse } from 'next/server';
import {
  readSessionCookie,
  isSessionExpired,
  refreshSession,
  createSessionCookie,
  clearSessionCookie,
} from '@/app/lib/auth/session';

// ---------------------------------------------------------------------------
// GET /api/auth/token
//
// Returns the current session's access_token to JavaScript so the SignalR
// hub and apiClient can attach it as `Authorization: Bearer <token>`.
//
// If the access_token is expired, attempts a silent refresh against Keycloak
// before returning. On successful refresh the session cookie is rotated. On
// failed refresh (refresh token expired or revoked) the session cookie is
// cleared and 401 is returned so the caller can redirect to /login.
//
// Cache: no-store — never let a CDN or browser stash a JWT.
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
      { accessToken: session.accessToken },
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
    { accessToken: refreshed.accessToken },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
  response.headers.append('Set-Cookie', createSessionCookie(refreshed));
  return response;
}
