import { type NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/app/lib/auth/config';
import { generateMockTokens, generateMockTokensForUser, MOCK_AUTH_USER } from '@/app/lib/auth/mock';
import { createSessionCookie } from '@/app/lib/auth/session';
import type { User } from '@/app/types';

// ---------------------------------------------------------------------------
// GET /api/auth/callback
//
// Handles the OIDC redirect back from Keycloak after the user authenticates.
//
// Steps:
//   1. Read `code` and `state` from the query string.
//   2. Validate `state` against the PKCE cookie set by the login route
//      (CSRF protection — ensures this callback was initiated by us).
//   3. Exchange the authorization `code` for tokens via Keycloak's token
//      endpoint (including the PKCE `code_verifier`).
//   4. Set the `stacksift_session` HTTP-only cookie with the token set.
//   5. Delete the short-lived PKCE cookie (cleanup).
//   6. Redirect to the dashboard (or the `next` URL saved in the PKCE cookie).
//
// On any error: redirect to /login?error=<reason> so the login page can
// show an appropriate toast notification.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // Keycloak sends ?error= if the user cancelled or something went wrong.
  if (errorParam) {
    return redirectToLoginWithError(origin, 'auth_cancelled');
  }

  if (!code || !state) {
    return redirectToLoginWithError(origin, 'missing_params');
  }

  // Read and validate the PKCE cookie for this state value.
  const pkceCookieName = `${authConfig.cookies.pkcePrefix}${state}`;
  const pkceRaw = request.cookies.get(pkceCookieName)?.value;

  if (!pkceRaw) {
    return redirectToLoginWithError(origin, 'invalid_state');
  }

  let pkceData: { codeVerifier: string; nonce: string; next: string };
  try {
    pkceData = JSON.parse(decodeURIComponent(pkceRaw)) as typeof pkceData;
  } catch {
    return redirectToLoginWithError(origin, 'invalid_state');
  }

  // Determine the post-login redirect target.
  const redirectTarget = pkceData.next ?? '/';

  // Clear the PKCE cookie (single-use).
  const clearPkceCookie = [
    `${pkceCookieName}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');

  // ---------------------------------------------------------------------------
  // Token exchange
  // ---------------------------------------------------------------------------

  let sessionCookie: string;

  if (authConfig.mockMode) {
    // Mock mode: don't call Keycloak, just generate fake tokens.
    //
    // When NEXT_PUBLIC_AUTH_MOCK_NEW_USER=true the "logged in" user has no
    // organisation — this triggers the US-03 onboarding flow in the browser.
    // Default (false / unset): use Alice Nguyen who already has an org.
    const isNewUser = process.env.NEXT_PUBLIC_AUTH_MOCK_NEW_USER === 'true';
    let tokens: ReturnType<typeof generateMockTokens>;
    if (isNewUser) {
      const newUser: User = { ...MOCK_AUTH_USER, organizationId: null };
      tokens = generateMockTokensForUser(newUser);
    } else {
      tokens = generateMockTokens();
    }
    sessionCookie = createSessionCookie(tokens);
  } else {
    // Real mode: POST to Keycloak token endpoint.
    let tokens: Record<string, unknown>;
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: authConfig.clientId,
        redirect_uri: authConfig.redirectUri,
        code,
        code_verifier: pkceData.codeVerifier,
      });

      const tokenResponse = await fetch(authConfig.endpoints.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!tokenResponse.ok) {
        console.error('[auth/callback] Token exchange failed:', tokenResponse.status);
        return redirectToLoginWithError(origin, 'token_exchange_failed');
      }

      tokens = (await tokenResponse.json()) as Record<string, unknown>;
    } catch (err) {
      console.error('[auth/callback] Token exchange error:', err);
      return redirectToLoginWithError(origin, 'token_exchange_failed');
    }

    sessionCookie = createSessionCookie({
      access_token: tokens['access_token'] as string,
      id_token: tokens['id_token'] as string,
      refresh_token: tokens['refresh_token'] as string,
      token_type: 'Bearer',
      expires_in: (tokens['expires_in'] as number) ?? 3600,
      scope: (tokens['scope'] as string) ?? '',
    });
  }

  // Build the response: set session cookie, clear PKCE cookie, redirect.
  const response = NextResponse.redirect(`${origin}${redirectTarget}`);
  response.headers.append('Set-Cookie', sessionCookie);
  response.headers.append('Set-Cookie', clearPkceCookie);
  return response;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function redirectToLoginWithError(origin: string, error: string): NextResponse {
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
}
