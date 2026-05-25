import { type NextRequest, NextResponse } from 'next/server';
import {
  readSessionCookie,
  refreshSession,
  createSessionCookie,
  clearSessionCookie,
} from '@/app/lib/auth/session';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = readSessionCookie(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const refreshed = await refreshSession(session);
  if (!refreshed) {
    const response = NextResponse.json({ error: 'session_expired' }, { status: 401 });
    response.headers.append('Set-Cookie', clearSessionCookie());
    return response;
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.headers.append('Set-Cookie', createSessionCookie(refreshed));
  return response;
}
