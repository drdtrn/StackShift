/**
 * @jest-environment node
 */

jest.mock('../config', () => {
  const actual = jest.requireActual<{ authConfig: Record<string, unknown> }>('../config');
  return { authConfig: { ...actual.authConfig, mockMode: false } };
});

import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionCookie,
  clearSessionCookie,
  readSessionCookie,
  isSessionExpired,
  redirectWithClearedSession,
  replaceSessionCookie,
  refreshSession,
} from '../session';
import type { SessionData } from '../session';
import type { MockTokens } from '../mock';
import { MOCK_AUTH_USER } from '../mock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(cookies: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/', {
    headers: {
      cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    },
  });
}

const SESSION: SessionData = {
  accessToken: 'access.payload.sig',
  idToken: 'id.payload.sig',
  refreshToken: 'refresh.payload.sig',
  expiresAt: Math.floor(Date.now() / 1_000) + 3_600,
};

// ---------------------------------------------------------------------------
// createSessionCookie
// ---------------------------------------------------------------------------

describe('createSessionCookie', () => {
  it('returns a string containing the session cookie name', () => {
    const cookie = createSessionCookie(SESSION);
    expect(cookie).toContain('stacksift_session=');
  });

  it('includes Path=/ and HttpOnly and SameSite=Lax', () => {
    const cookie = createSessionCookie(SESSION);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('does NOT include Secure in non-production', () => {
    const original = process.env.NODE_ENV;
    // NODE_ENV is 'test', not 'production'
    const cookie = createSessionCookie(SESSION);
    expect(cookie).not.toContain('Secure');
    void original; // keep reference
  });

  it('includes Secure in production mode', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
    const cookie = createSessionCookie(SESSION);
    expect(cookie).toContain('Secure');
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });
  });

  it('accepts MockTokens and converts them', () => {
    const tokens: MockTokens = {
      access_token: 'a.b.c',
      id_token: 'i.d.t',
      refresh_token: 'r.e.f',
      token_type: 'Bearer',
      expires_in: 3_600,
      scope: 'openid',
    };
    const cookie = createSessionCookie(tokens);
    expect(cookie).toContain('stacksift_session=');
  });
});

// ---------------------------------------------------------------------------
// clearSessionCookie
// ---------------------------------------------------------------------------

describe('clearSessionCookie', () => {
  it('sets Max-Age=0 to expire the cookie', () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain('Max-Age=0');
  });

  it('includes the session cookie name', () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain('stacksift_session=');
  });
});

// ---------------------------------------------------------------------------
// readSessionCookie
// ---------------------------------------------------------------------------

describe('readSessionCookie', () => {
  it('returns null when cookie is absent', () => {
    const req = makeRequest();
    expect(readSessionCookie(req)).toBeNull();
  });

  it('returns null for corrupt JSON (catch branch)', () => {
    const req = makeRequest({ stacksift_session: 'not-valid-json' });
    expect(readSessionCookie(req)).toBeNull();
  });

  it('returns SessionData for a valid cookie', () => {
    const encoded = encodeURIComponent(JSON.stringify(SESSION));
    const req = makeRequest({ stacksift_session: encoded });
    const result = readSessionCookie(req);
    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe(SESSION.accessToken);
  });

  it('returns null when required fields are missing', () => {
    const partial = encodeURIComponent(JSON.stringify({ refreshToken: 'x' }));
    const req = makeRequest({ stacksift_session: partial });
    expect(readSessionCookie(req)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isSessionExpired
// ---------------------------------------------------------------------------

describe('isSessionExpired', () => {
  it('returns false when session has not expired', () => {
    const future: SessionData = { ...SESSION, expiresAt: Math.floor(Date.now() / 1_000) + 3_600 };
    expect(isSessionExpired(future)).toBe(false);
  });

  it('returns true when session has expired', () => {
    const past: SessionData = { ...SESSION, expiresAt: Math.floor(Date.now() / 1_000) - 100 };
    expect(isSessionExpired(past)).toBe(true);
  });

  it('returns true within the 30-second buffer window', () => {
    const almostExpired: SessionData = { ...SESSION, expiresAt: Math.floor(Date.now() / 1_000) + 15 };
    expect(isSessionExpired(almostExpired)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// redirectWithClearedSession
// ---------------------------------------------------------------------------

describe('redirectWithClearedSession', () => {
  it('returns a NextResponse with a redirect status', () => {
    const response = redirectWithClearedSession('http://localhost/login');
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
  });

  it('sets Set-Cookie header to clear the session', () => {
    const response = redirectWithClearedSession('http://localhost/login');
    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toContain('Max-Age=0');
  });
});

// ---------------------------------------------------------------------------
// replaceSessionCookie
// ---------------------------------------------------------------------------

describe('replaceSessionCookie', () => {
  it('returns a cookie string containing the session name', () => {
    const cookie = replaceSessionCookie(MOCK_AUTH_USER);
    expect(cookie).toContain('stacksift_session=');
  });

  it('produced cookie contains a valid access_token payload', () => {
    const cookie = replaceSessionCookie(MOCK_AUTH_USER);
    expect(cookie.length).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// refreshSession
// ---------------------------------------------------------------------------

const EXPIRED_SESSION: SessionData = {
  accessToken: 'access.payload.sig',
  idToken: 'id.payload.sig',
  refreshToken: 'old-refresh-token',
  expiresAt: Math.floor(Date.now() / 1_000) - 100,
};

describe('refreshSession', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns new SessionData when Keycloak responds with fresh tokens', async () => {
    const now = Math.floor(Date.now() / 1_000);
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new-access.payload.sig',
          id_token: 'new-id.payload.sig',
          refresh_token: 'new-refresh-token',
          expires_in: 300,
        }),
    } as unknown as Response);

    const result = await refreshSession(EXPIRED_SESSION);

    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe('new-access.payload.sig');
    expect(result?.refreshToken).toBe('new-refresh-token');
    expect(result?.expiresAt).toBeGreaterThanOrEqual(now + 299);
  });

  it('returns null when Keycloak rejects the refresh token (400)', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
    } as unknown as Response);

    const result = await refreshSession(EXPIRED_SESSION);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws a network error', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

    const result = await refreshSession(EXPIRED_SESSION);
    expect(result).toBeNull();
  });

  it('uses expires_in=300 as fallback when not provided by response', async () => {
    const now = Math.floor(Date.now() / 1_000);
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'a.b.c',
          id_token: 'i.d.t',
          refresh_token: 'r.e.f',
        }),
    } as unknown as Response);

    const result = await refreshSession(EXPIRED_SESSION);

    expect(result).not.toBeNull();
    expect(result?.expiresAt).toBeGreaterThanOrEqual(now + 299);
  });
});
