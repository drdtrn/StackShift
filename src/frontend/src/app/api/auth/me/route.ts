import { type NextRequest, NextResponse } from 'next/server';
import { getSessionUser, readSessionCookie, isSessionExpired } from '@/app/lib/auth/session';

// ---------------------------------------------------------------------------
// GET /api/auth/me
//
// Returns the current authenticated user's profile as JSON.
//
// This is the "bridge" between the HTTP-only session cookie (which JavaScript
// cannot read directly) and the client-side useAuthStore (Zustand). The
// useSession hook calls this endpoint on mount to restore the session state
// after a page reload.
//
// Response shapes:
//   200 { id, email, displayName, role, organizationId, avatarUrl, ... }
//   401 { error: "unauthenticated" }   — no session or expired
//   401 { error: "session_expired" }   — token past expiry
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = readSessionCookie(request);

  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  if (isSessionExpired(session)) {
    return NextResponse.json({ error: 'session_expired' }, { status: 401 });
  }

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  return NextResponse.json(user, { status: 200 });
}
