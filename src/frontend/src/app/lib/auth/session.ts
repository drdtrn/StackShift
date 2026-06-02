import { type NextRequest, NextResponse } from 'next/server';
import { authConfig } from './config';
import { extractUserFromToken, generateMockTokensForUser, type MockTokens } from './mock';
import type { User } from '@/app/types';

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

export interface SessionData {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (seconds)
}

// The session cookie must be Secure whenever TLS terminates in front of the app.
// Production always qualifies; COOKIE_SECURE forces it for any HTTPS deployment
// that doesn't run with NODE_ENV=production.
function useSecureCookie(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
}

// ---------------------------------------------------------------------------
// createSessionCookie
//
// Serializes the token set into a JSON string and returns an HTTP-only
// cookie header value. Called from the callback route handler after
// successful token exchange.
//
// Security properties:
//   - httpOnly: JavaScript cannot read this cookie (prevents XSS token theft)
//   - secure: only sent over HTTPS (enforced in production)
//   - sameSite=lax: sent on top-level navigations but not cross-site requests
//     (CSRF protection while still working with Keycloak's redirect back)
//   - path=/: cookie is sent with every request to this origin
// ---------------------------------------------------------------------------

export function createSessionCookie(tokens: MockTokens | SessionData): string {
  const session: SessionData =
    'accessToken' in tokens
      ? tokens
      : {
          accessToken: tokens.access_token,
          idToken: tokens.id_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Math.floor(Date.now() / 1_000) + tokens.expires_in,
        };

  const value = encodeURIComponent(JSON.stringify(session));

  const parts = [
    `${authConfig.cookies.session}=${value}`,
    'Path=/',
    `Max-Age=${authConfig.sessionMaxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (useSecureCookie()) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

// ---------------------------------------------------------------------------
// clearSessionCookie
//
// Returns a cookie header value that immediately expires the session cookie.
// Used by the logout route handler.
// ---------------------------------------------------------------------------

export function clearSessionCookie(): string {
  const parts = [
    `${authConfig.cookies.session}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (useSecureCookie()) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

// ---------------------------------------------------------------------------
// readSessionCookie
//
// Reads the session cookie from an incoming request, parses the JSON,
// and returns the SessionData or null if absent/corrupt.
// ---------------------------------------------------------------------------

export function readSessionCookie(request: NextRequest): SessionData | null {
  try {
    const raw = request.cookies.get(authConfig.cookies.session)?.value;
    if (!raw) return null;

    const decoded = decodeURIComponent(raw);
    const session = JSON.parse(decoded) as SessionData;

    if (!session.accessToken || !session.expiresAt) return null;

    return session;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// getSessionUser
//
// Reads the session cookie and extracts the User profile from the
// access_token JWT claims. Returns null if no session or token is corrupt.
// ---------------------------------------------------------------------------

export function getSessionUser(request: NextRequest): User | null {
  const session = readSessionCookie(request);
  if (!session) return null;

  return extractUserFromToken(session.accessToken);
}

// Same as getSessionUser, but reads the cookie from `next/headers.cookies()`
// for use in server components / layouts (no NextRequest available there).
// Imported lazily so client-side bundles don't pull in next/headers.
export async function getServerSessionUser(): Promise<User | null> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  const raw = store.get(authConfig.cookies.session)?.value;
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw);
    const session = JSON.parse(decoded) as SessionData;
    if (!session.accessToken) return null;
    return extractUserFromToken(session.accessToken);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// isSessionExpired
//
// Checks whether the access token has expired (with a 30-second buffer
// to avoid race conditions at the edge of the expiry window).
// ---------------------------------------------------------------------------

export function isSessionExpired(session: SessionData): boolean {
  const nowSeconds = Math.floor(Date.now() / 1_000);
  return session.expiresAt - 30 < nowSeconds;
}

// ---------------------------------------------------------------------------
// redirectWithClearedSession
//
// Utility that returns a redirect response while also clearing the session
// cookie. Used when an expired/invalid session is detected.
// ---------------------------------------------------------------------------

export function redirectWithClearedSession(url: string): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set('Set-Cookie', clearSessionCookie());
  return response;
}

// ---------------------------------------------------------------------------
// refreshSession
//
// Exchanges the stored refresh_token for a new access_token + refresh_token
// pair via Keycloak's token endpoint. Returns new SessionData (ready to be
// written back as a cookie) or null when the refresh token is expired or
// revoked — the caller must then clear the cookie and redirect to /login.
//
// In mock mode the refresh is simulated locally so offline dev keeps working.
// ---------------------------------------------------------------------------

export async function refreshSession(
  session: SessionData,
): Promise<SessionData | null> {
  if (authConfig.mockMode) {
    const user = extractUserFromToken(session.accessToken);
    if (!user) return null;
    const tokens = generateMockTokensForUser(user);
    return {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1_000) + tokens.expires_in,
    };
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: authConfig.clientId,
      refresh_token: session.refreshToken,
    });

    const response = await fetch(authConfig.endpoints.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const tokens = (await response.json()) as {
      access_token: string;
      id_token: string;
      refresh_token: string;
      expires_in?: number;
    };

    return {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1_000) + (tokens.expires_in ?? 300),
    };
  } catch {
    return null;
  }
}
