import { type NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/app/lib/auth/config';
import { clearSessionCookie, readSessionCookie } from '@/app/lib/auth/session';

// ---------------------------------------------------------------------------
// GET /api/auth/logout
//
// Terminates the user's session.
//
// Steps:
//   1. Read the current session to get the id_token (needed for Keycloak
//      logout to fully terminate the SSO session across all clients).
//   2. Clear the stacksift_session HTTP-only cookie.
//   3. Redirect to Keycloak's logout endpoint (which revokes the tokens
//      and ends the SSO session), which then redirects back to /login.
//
// In mock mode: skip Keycloak, just clear the cookie and go to /login.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { origin } = new URL(request.url);
  const session = readSessionCookie(request);

  const cookieHeader = clearSessionCookie();

  if (authConfig.mockMode || !session?.idToken) {
    // Mock mode or no session — just clear and redirect to login.
    const response = NextResponse.redirect(`${origin}/login`);
    response.headers.set('Set-Cookie', cookieHeader);
    return response;
  }

  // Real mode: redirect to Keycloak's logout endpoint.
  // post_logout_redirect_uri tells Keycloak where to send the user after logout.
  // id_token_hint allows Keycloak to identify the session to revoke.
  const logoutUrl = new URL(authConfig.endpoints.logout);
  logoutUrl.searchParams.set('post_logout_redirect_uri', `${origin}/login`);
  logoutUrl.searchParams.set('id_token_hint', session.idToken);
  logoutUrl.searchParams.set('client_id', authConfig.clientId);

  const response = NextResponse.redirect(logoutUrl.toString());
  response.headers.set('Set-Cookie', cookieHeader);
  return response;
}
