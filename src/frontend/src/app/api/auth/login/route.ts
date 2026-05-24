import { type NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/app/lib/auth/config';
import { createSessionCookie } from '@/app/lib/auth/session';
import { loginSchema } from '@/app/lib/schemas/auth';

// GET is the legacy redirect-based flow (Google SSO / PKCE).
// POST is the in-app ROPC flow used by the new /login form.
export { GET } from './sso-redirect';

interface KeycloakTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const form = new URLSearchParams({
    grant_type: 'password',
    client_id: authConfig.clientId,
    username: parsed.data.email,
    password: parsed.data.password,
    scope: authConfig.scopes.join(' '),
  });

  let keycloakResponse: Response;
  try {
    keycloakResponse = await fetch(authConfig.endpoints.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 });
  }

  if (keycloakResponse.status === 401 || keycloakResponse.status === 400) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }
  if (!keycloakResponse.ok) {
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
  }

  let tokens: KeycloakTokenResponse;
  try {
    tokens = (await keycloakResponse.json()) as KeycloakTokenResponse;
  } catch {
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
  }

  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.headers.set('Set-Cookie', createSessionCookie(tokens));
  return response;
}
