import { type NextRequest, NextResponse } from 'next/server';
import {
  readSessionCookie,
  refreshSession,
  createSessionCookie,
} from '@/app/lib/auth/session';
import { createOrganisationSchema } from '@/app/lib/schemas/organisation';

function apiBase(): string {
  // Server-side hop: prefer the container-internal URL (see register route).
  return (
    process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5190'
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = readSessionCookie(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = createOrganisationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase()}/api/v1/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 });
  }

  const upstreamBody = await upstream.text();

  if (!upstream.ok) {
    return new NextResponse(upstreamBody, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  }

  // The backend has set the organization_id attribute on the Keycloak user,
  // but the current access token in the cookie still carries the old (null)
  // claim. A refresh_token grant against Keycloak re-mints both tokens with
  // the fresh attributes so the very next request flows with the new claim.
  const refreshed = await refreshSession(session);
  const response = new NextResponse(upstreamBody, {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
  if (refreshed) {
    response.headers.set('Set-Cookie', createSessionCookie(refreshed));
  }
  return response;
}
