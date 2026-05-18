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
  const isProduction = process.env.NODE_ENV === 'production';

  const parts = [
    `${authConfig.cookies.session}=${value}`,
    'Path=/',
    `Max-Age=${authConfig.sessionMaxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (isProduction) {
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
  return [
    `${authConfig.cookies.session}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');
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
// replaceSessionCookie
//
// Builds a new session cookie by regenerating mock tokens for an updated
// user object. Called after organisation creation to inject organization_id
// into the session without requiring a full re-login.
//
// This only applies in mock mode. In production, Keycloak would issue a
// fresh token with the org claim via a silent refresh or re-auth.
// ---------------------------------------------------------------------------

export function replaceSessionCookie(updatedUser: User): string {
  const tokens = generateMockTokensForUser(updatedUser);
  return createSessionCookie(tokens);
}
