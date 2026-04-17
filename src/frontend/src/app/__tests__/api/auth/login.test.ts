/**
 * @jest-environment node
 *
 * Tests for GET /api/auth/login
 *
 * The login route:
 *   - Generates a PKCE state + code verifier
 *   - Stores them in a short-lived HTTP-only cookie
 *   - Redirects to the Keycloak authorize URL (real mode)
 *     OR to /api/auth/callback?code=mock_code&state=... (mock mode)
 *   - Validates the ?next= param to prevent open redirect attacks
 *
 * Testing approach: import the route module directly and call GET() with a
 * mock NextRequest. Inspect the response status and headers without spinning
 * up a real Next.js server.
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/login/route';

// ---------------------------------------------------------------------------
// Mock authConfig so we can switch mock mode in individual tests
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
      authorize: 'http://localhost:8080/realms/stacksift/protocol/openid-connect/auth',
      token: 'http://localhost:8080/realms/stacksift/protocol/openid-connect/token',
      logout: 'http://localhost:8080/realms/stacksift/protocol/openid-connect/logout',
    },
  },
}));

// PKCE helpers return predictable values in tests
jest.mock('@/app/lib/auth/pkce', () => ({
  generateState: jest.fn(() => 'test-state-abc123'),
  generateNonce: jest.fn(() => 'test-nonce-xyz789'),
  generateCodeVerifier: jest.fn(() => 'test-verifier-111'),
  generateCodeChallenge: jest.fn(() => Promise.resolve('test-challenge-222')),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string): NextRequest {
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/auth/login', () => {
  describe('mock mode (default)', () => {
    it('redirects to /api/auth/callback with mock code and state', async () => {
      const req = makeRequest('http://localhost:3000/api/auth/login');
      const res = await GET(req);

      expect(res.status).toBe(307); // NextResponse.redirect default
      const location = res.headers.get('location');
      expect(location).toContain('/api/auth/callback');
      expect(location).toContain('code=mock_code');
      expect(location).toContain('state=test-state-abc123');
    });

    it('sets a PKCE cookie with the state as part of the name', async () => {
      const req = makeRequest('http://localhost:3000/api/auth/login');
      const res = await GET(req);

      const cookie = res.headers.get('set-cookie');
      expect(cookie).not.toBeNull();
      expect(cookie).toContain('stacksift_pkce_test-state-abc123=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=600');
    });

    it('stores the codeVerifier, nonce, and next in the PKCE cookie', async () => {
      const req = makeRequest('http://localhost:3000/api/auth/login?next=/incidents');
      const res = await GET(req);

      const cookie = res.headers.get('set-cookie') ?? '';
      // Extract the cookie value
      const match = cookie.match(/stacksift_pkce_[^=]+=([^;]+)/);
      expect(match).not.toBeNull();
      const decoded = JSON.parse(decodeURIComponent(match![1])) as {
        codeVerifier: string;
        nonce: string;
        next: string;
      };
      expect(decoded.codeVerifier).toBe('test-verifier-111');
      expect(decoded.nonce).toBe('test-nonce-xyz789');
      expect(decoded.next).toBe('/incidents');
    });

    it('defaults next to "/" when not provided', async () => {
      const req = makeRequest('http://localhost:3000/api/auth/login');
      const res = await GET(req);

      const cookie = res.headers.get('set-cookie') ?? '';
      const match = cookie.match(/stacksift_pkce_[^=]+=([^;]+)/);
      const decoded = JSON.parse(decodeURIComponent(match![1])) as { next: string };
      expect(decoded.next).toBe('/');
    });
  });

  describe('open redirect protection', () => {
    it('rejects absolute URLs in ?next= and defaults to /', async () => {
      const req = makeRequest('http://localhost:3000/api/auth/login?next=https://evil.com');
      const res = await GET(req);

      const cookie = res.headers.get('set-cookie') ?? '';
      const match = cookie.match(/stacksift_pkce_[^=]+=([^;]+)/);
      const decoded = JSON.parse(decodeURIComponent(match![1])) as { next: string };
      expect(decoded.next).toBe('/');
    });

    it('rejects protocol-relative URLs (//) in ?next=', async () => {
      const req = makeRequest('http://localhost:3000/api/auth/login?next=//evil.com');
      const res = await GET(req);

      const cookie = res.headers.get('set-cookie') ?? '';
      const match = cookie.match(/stacksift_pkce_[^=]+=([^;]+)/);
      const decoded = JSON.parse(decodeURIComponent(match![1])) as { next: string };
      expect(decoded.next).toBe('/');
    });

    it('allows relative paths like /dashboard', async () => {
      const req = makeRequest('http://localhost:3000/api/auth/login?next=/dashboard');
      const res = await GET(req);

      const cookie = res.headers.get('set-cookie') ?? '';
      const match = cookie.match(/stacksift_pkce_[^=]+=([^;]+)/);
      const decoded = JSON.parse(decodeURIComponent(match![1])) as { next: string };
      expect(decoded.next).toBe('/dashboard');
    });
  });

  describe('real mode (mockMode=false)', () => {
    beforeEach(() => {
      // Override the mock to disable mock mode for this describe block
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require('@/app/lib/auth/config');
      config.authConfig.mockMode = false;
    });

    afterEach(() => {
      // Restore mock mode
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require('@/app/lib/auth/config');
      config.authConfig.mockMode = true;
    });

    it('redirects to the Keycloak authorize endpoint', async () => {
      const req = makeRequest('http://localhost:3000/api/auth/login');
      const res = await GET(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location') ?? '';
      expect(location).toContain('localhost:8080');
      expect(location).toContain('openid-connect/auth');
      expect(location).toContain('client_id=stacksift-frontend');
      expect(location).toContain('response_type=code');
      expect(location).toContain('code_challenge_method=S256');
      expect(location).toContain('state=test-state-abc123');
    });
  });
});
