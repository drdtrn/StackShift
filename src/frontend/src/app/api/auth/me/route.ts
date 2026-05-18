import { type NextRequest, NextResponse } from 'next/server';
import {
  readSessionCookie,
  isSessionExpired,
  refreshSession,
  createSessionCookie,
  clearSessionCookie,
  getSessionUser,
} from '@/app/lib/auth/session';
import { extractUserFromToken } from '@/app/lib/auth/mock';

// ---------------------------------------------------------------------------
// GET /api/auth/me
//
// Returns the current authenticated user's profile as JSON.
//
// If the access_token is expired, attempts a silent refresh before reading
// claims so a near-expiry page load doesn't incorrectly log the user out.
// On successful refresh the session cookie is rotated in the response.
//
// Response shapes:
//   200 { id, email, displayName, role, organizationId, avatarUrl, ... }
//   401 { error: "unauthenticated" }  — no session cookie present
//   401 { error: "session_expired" }  — refresh token also expired / revoked
//   401 { error: "invalid_token" }    — cookie present but JWT unparseable
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = readSessionCookie(request);

  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  if (isSessionExpired(session)) {
    const refreshed = await refreshSession(session);

    if (!refreshed) {
      const response = NextResponse.json({ error: 'session_expired' }, { status: 401 });
      response.headers.append('Set-Cookie', clearSessionCookie());
      return response;
    }

    const user = extractUserFromToken(refreshed.accessToken);
    if (!user) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    const response = NextResponse.json(user, { status: 200 });
    response.headers.append('Set-Cookie', createSessionCookie(refreshed));
    return response;
  }

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  return NextResponse.json(user, { status: 200 });
}
