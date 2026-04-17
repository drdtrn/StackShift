import { type NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/app/lib/auth/config';
import { generateState, generateNonce, generateCodeVerifier, generateCodeChallenge } from '@/app/lib/auth/pkce';

// ---------------------------------------------------------------------------
// GET /api/auth/login
//
// Initiates the OIDC Authorization Code + PKCE flow.
//
// Steps:
//   1. Generate a cryptographically random `state`, `nonce`, and PKCE pair.
//   2. Store them in a short-lived HTTP-only cookie so the callback route
//      can verify them after the Keycloak redirect.
//   3. Build the Keycloak authorization URL with all required parameters.
//   4. Return a 302 redirect to Keycloak (or mock callback in mock mode).
//
// The `?next=` query param allows redirect-back after login:
//   e.g. user tries to visit /incidents → redirected to /login?next=/incidents
//        → login button points to /api/auth/login?next=/incidents
//        → after successful auth, callback route redirects to /incidents
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get('next') ?? '/';

  // Validate the `next` URL to prevent open redirect attacks.
  // Only allow relative paths starting with /
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const state = generateState();
  const nonce = generateNonce();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store PKCE state in a short-lived cookie (10-minute expiry).
  // The cookie name includes the state value so it's unique per login attempt.
  const pkceData = JSON.stringify({ codeVerifier, nonce, next: safeNext });
  const pkceCookie = [
    `${authConfig.cookies.pkcePrefix}${state}=${encodeURIComponent(pkceData)}`,
    'Path=/',
    'Max-Age=600', // 10 minutes
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');

  if (authConfig.mockMode) {
    // Mock mode: skip real Keycloak, redirect straight to callback
    // with a mock code and the state we just generated.
    const callbackUrl = new URL(`${request.nextUrl.origin}/api/auth/callback`);
    callbackUrl.searchParams.set('code', 'mock_code');
    callbackUrl.searchParams.set('state', state);

    const response = NextResponse.redirect(callbackUrl.toString());
    response.headers.set('Set-Cookie', pkceCookie);
    return response;
  }

  // Real mode: build the Keycloak authorization URL.
  const authorizeUrl = new URL(authConfig.endpoints.authorize);
  authorizeUrl.searchParams.set('client_id', authConfig.clientId);
  authorizeUrl.searchParams.set('redirect_uri', authConfig.redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', authConfig.scopes.join(' '));
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('nonce', nonce);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.headers.set('Set-Cookie', pkceCookie);
  return response;
}
