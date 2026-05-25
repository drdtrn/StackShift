/**
 * @jest-environment node
 *
 * Tests for POST /api/onboarding/create-org — the real-backend proxy (ORG-1).
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/onboarding/create-org/route';
import { MOCK_AUTH_USER, generateMockTokensForUser } from '@/app/lib/auth/mock';
import { createSessionCookie } from '@/app/lib/auth/session';

function sessionCookieHeader(): string {
  const tokens = generateMockTokensForUser(MOCK_AUTH_USER);
  return createSessionCookie(tokens);
}

function authedRequest(body: unknown): NextRequest {
  const setCookie = sessionCookieHeader();
  const cookieHeader = setCookie.split(';')[0];
  return new NextRequest('http://localhost:3000/api/onboarding/create-org', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify(body),
  });
}

function anonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/onboarding/create-org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_BODY = { name: 'Acme Corp' };

describe('POST /api/onboarding/create-org', () => {
  const realFetch = global.fetch;
  const realEnv = process.env.NEXT_PUBLIC_API_URL;
  const realKeycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL;
  const realAuthMock = process.env.NEXT_PUBLIC_AUTH_MOCK;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test:5190';
    process.env.NEXT_PUBLIC_AUTH_MOCK = 'true';
    delete process.env.NEXT_PUBLIC_KEYCLOAK_URL;
  });

  afterEach(() => {
    global.fetch = realFetch;
    if (realEnv === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = realEnv;
    if (realKeycloakUrl === undefined) delete process.env.NEXT_PUBLIC_KEYCLOAK_URL;
    else process.env.NEXT_PUBLIC_KEYCLOAK_URL = realKeycloakUrl;
    if (realAuthMock === undefined) delete process.env.NEXT_PUBLIC_AUTH_MOCK;
    else process.env.NEXT_PUBLIC_AUTH_MOCK = realAuthMock;
  });

  it('returns 401 when no session cookie is present', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const res = await POST(anonRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 on validation failure (short name)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const res = await POST(authedRequest({ name: 'X' }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the bearer token + JSON body to the .NET API', async () => {
    const upstreamBody = JSON.stringify({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Acme Corp',
      slug: 'acme-corp',
      logoUrl: null,
      plan: 'free',
      createdAt: '2026-05-25T09:00:00.000Z',
      updatedAt: '2026-05-25T09:00:00.000Z',
    });

    const fetchMock = jest.fn((url: string) => {
      if (url.endsWith('/api/v1/organizations')) {
        return Promise.resolve(new Response(upstreamBody, { status: 201 }));
      }
      // refreshSession path — return a token-endpoint shape so refresh succeeds
      return Promise.resolve(
        jsonResponse(200, {
          access_token: 'new.access',
          id_token: 'new.id',
          refresh_token: 'new.refresh',
          expires_in: 300,
        }),
      );
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const res = await POST(authedRequest(VALID_BODY));
    expect(res.status).toBe(201);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method?: string; headers?: Record<string, string>; body?: string },
    ];
    expect(url).toBe('http://api.test:5190/api/v1/organizations');
    expect(init.method).toBe('POST');
    expect(init.headers?.Authorization).toMatch(/^Bearer /);
    expect(JSON.parse(init.body ?? '')).toEqual({ name: 'Acme Corp' });
  });

  it('refreshes the Keycloak session on success and rotates the cookie', async () => {
    process.env.NEXT_PUBLIC_AUTH_MOCK = 'false';
    process.env.NEXT_PUBLIC_KEYCLOAK_URL = 'http://kc.test:8080';
    const upstreamBody = JSON.stringify({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Acme Corp',
      slug: 'acme-corp',
      logoUrl: null,
      plan: 'free',
      createdAt: '2026-05-25T09:00:00.000Z',
      updatedAt: '2026-05-25T09:00:00.000Z',
    });

    const fetchMock = jest.fn((url: string) => {
      if (url.includes('/api/v1/organizations')) {
        return Promise.resolve(new Response(upstreamBody, { status: 201 }));
      }
      if (url.includes('protocol/openid-connect/token')) {
        return Promise.resolve(
          jsonResponse(200, {
            access_token: 'new.access',
            id_token: 'new.id',
            refresh_token: 'new.refresh',
            expires_in: 300,
          }),
        );
      }
      throw new Error(`unexpected ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const res = await POST(authedRequest(VALID_BODY));
    expect(res.status).toBe(201);

    const tokenCall = fetchMock.mock.calls.find(([u]) =>
      typeof u === 'string' && u.includes('protocol/openid-connect/token'),
    );
    expect(tokenCall).toBeDefined();

    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('stacksift_session=');
  });

  it('forwards a 409 from upstream verbatim', async () => {
    const upstreamBody = JSON.stringify({ type: 'about:blank', status: 409, title: 'Conflict' });
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(upstreamBody, {
          status: 409,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ) as unknown as typeof global.fetch;

    const res = await POST(authedRequest(VALID_BODY));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(upstreamBody);
  });

  it('returns 502 when the upstream fetch throws', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('connection refused')) as unknown as typeof global.fetch;

    const res = await POST(authedRequest(VALID_BODY));
    expect(res.status).toBe(502);
  });
});
