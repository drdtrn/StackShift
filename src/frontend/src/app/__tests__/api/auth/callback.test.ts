/**
 * @jest-environment node
 *
 * Tests for GET /api/auth/callback
 *
 * The callback route:
 *   - Reads `code` and `state` from the query string
 *   - Validates `state` against the PKCE cookie
 *   - Exchanges the code for tokens (mock: generates fake tokens)
 *   - Sets the stacksift_session cookie
 *   - Redirects to / or the ?next= URL saved in the PKCE data
 *
 * Error cases redirect to /login?error=<reason>:
 *   - Missing code or state
 *   - PKCE cookie missing (possible CSRF / state mismatch)
 *   - Keycloak returns ?error=
 *   - Token exchange fails (real mode only)
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/callback/route';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/app/lib/auth/config', () => ({
  authConfig: {
    mockMode: true,
    clientId: 'stacksift-frontend',
    redirectUri: 'http://localhost:3000/api/auth/callback',
    scopes: ['openid', 'profile', 'email'],
    cookies: {
      session: 'stacksift_session',
      pkcePrefix: 'stacksift_pkce_',
    },
    sessionMaxAge: 86400,
    endpoints: {
      token: 'http://localhost:8080/realms/stacksift/protocol/openid-connect/token',
      logout: 'http://localhost:8080/realms/stacksift/protocol/openid-connect/logout',
    },
  },
}));

jest.mock('@/app/lib/auth/mock', () => ({
  generateMockTokens: jest.fn(() => ({
    access_token: 'mock.access.token',
    id_token: 'mock.id.token',
    refresh_token: 'mock.refresh.token',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'openid profile email',
  })),
}));

jest.mock('@/app/lib/auth/session', () => ({
  createSessionCookie: jest.fn(() => 'stacksift_session=mock-session-value; Path=/; HttpOnly; SameSite=Lax'),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPkceCookieValue(data: {
  codeVerifier: string;
  nonce: string;
  next: string;
}): string {
  return encodeURIComponent(JSON.stringify(data));
}

function makeRequest(url: string, cookies: Record<string, string> = {}): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  return new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

const VALID_PKCE_COOKIE_VALUE = buildPkceCookieValue({
  codeVerifier: 'test-verifier-111',
  nonce: 'test-nonce-xyz789',
  next: '/',
});

const PKCE_COOKIE_NAME = 'stacksift_pkce_test-state-abc123';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/auth/callback', () => {
  describe('error cases — redirect to /login with error param', () => {
    it('redirects with auth_cancelled when Keycloak sends ?error=', async () => {
      const req = makeRequest(
        'http://localhost:3000/api/auth/callback?error=access_denied&state=test-state-abc123',
      );
      const res = await GET(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location') ?? '';
      expect(location).toContain('/login');
      expect(location).toContain('error=auth_cancelled');
    });

    it('redirects with missing_params when code is absent', async () => {
      const req = makeRequest(
        'http://localhost:3000/api/auth/callback?state=test-state-abc123',
      );
      const res = await GET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('error=missing_params');
    });

    it('redirects with missing_params when state is absent', async () => {
      const req = makeRequest(
        'http://localhost:3000/api/auth/callback?code=some-code',
      );
      const res = await GET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('error=missing_params');
    });

    it('redirects with invalid_state when PKCE cookie is missing', async () => {
      // No cookies at all — PKCE cookie not set
      const req = makeRequest(
        'http://localhost:3000/api/auth/callback?code=some-code&state=test-state-abc123',
      );
      const res = await GET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('error=invalid_state');
    });

    it('redirects with invalid_state when PKCE cookie contains malformed JSON', async () => {
      const req = makeRequest(
        'http://localhost:3000/api/auth/callback?code=some-code&state=test-state-abc123',
        { [PKCE_COOKIE_NAME]: 'not-valid-json' },
      );
      const res = await GET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('error=invalid_state');
    });
  });

  describe('mock mode — successful flow', () => {
    it('redirects to / on success (no next param)', async () => {
      const req = makeRequest(
        'http://localhost:3000/api/auth/callback?code=mock_code&state=test-state-abc123',
        { [PKCE_COOKIE_NAME]: VALID_PKCE_COOKIE_VALUE },
      );
      const res = await GET(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location') ?? '';
      expect(location).toBe('http://localhost:3000/');
    });

    it('redirects to the ?next= URL stored in the PKCE cookie', async () => {
      const pkceValue = buildPkceCookieValue({
        codeVerifier: 'test-verifier-111',
        nonce: 'test-nonce-xyz789',
        next: '/incidents',
      });
      const req = makeRequest(
        'http://localhost:3000/api/auth/callback?code=mock_code&state=test-state-abc123',
        { [PKCE_COOKIE_NAME]: pkceValue },
      );
      const res = await GET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/incidents');
    });

    it('sets the stacksift_session cookie on the response', async () => {
      const req = makeRequest(
        'http://localhost:3000/api/auth/callback?code=mock_code&state=test-state-abc123',
        { [PKCE_COOKIE_NAME]: VALID_PKCE_COOKIE_VALUE },
      );
      const res = await GET(req);

      const setCookie = res.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('stacksift_session');
      expect(setCookie).toContain('HttpOnly');
    });

    it('clears the PKCE cookie on the response', async () => {
      const req = makeRequest(
        'http://localhost:3000/api/auth/callback?code=mock_code&state=test-state-abc123',
        { [PKCE_COOKIE_NAME]: VALID_PKCE_COOKIE_VALUE },
      );
      const res = await GET(req);

      const setCookie = res.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('stacksift_pkce_');
      expect(setCookie).toContain('Max-Age=0');
    });
  });
});
