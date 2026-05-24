/**
 * @jest-environment node
 *
 * Tests for POST /api/auth/login — the in-app ROPC flow (NUF-3).
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/auth/config', () => ({
  authConfig: {
    mockMode: false,
    clientId: 'stacksift-frontend',
    scopes: ['openid', 'profile', 'email'],
    cookies: { session: 'stacksift_session', pkcePrefix: 'stacksift_pkce_' },
    sessionMaxAge: 86_400,
    endpoints: {
      authorize: 'http://kc.test/realms/stacksift/protocol/openid-connect/auth',
      token: 'http://kc.test/realms/stacksift/protocol/openid-connect/token',
      logout: 'http://kc.test/realms/stacksift/protocol/openid-connect/logout',
    },
  },
}));

import { POST } from '@/app/api/auth/login/route';

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function keycloakOk(): Response {
  return new Response(
    JSON.stringify({
      access_token: 'fake.access',
      id_token: 'fake.id',
      refresh_token: 'fake.refresh',
      token_type: 'Bearer',
      expires_in: 300,
      scope: 'openid profile email',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('POST /api/auth/login', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('forwards credentials to the Keycloak token endpoint and sets the session cookie', async () => {
    const fetchMock = jest.fn().mockResolvedValue(keycloakOk());
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const res = await POST(
      postRequest({ email: 'alice@example.com', password: 'sekrit' }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method?: string; body?: string },
    ];
    expect(url).toBe('http://kc.test/realms/stacksift/protocol/openid-connect/token');
    expect(init.method).toBe('POST');
    expect(init.body).toContain('grant_type=password');
    expect(init.body).toContain('username=alice%40example.com');
    expect(init.body).toContain('password=sekrit');
    expect(init.body).toContain('client_id=stacksift-frontend');

    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('stacksift_session=');
    expect(cookie).toContain('HttpOnly');
  });

  it('returns 401 when Keycloak rejects the credentials', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 })) as unknown as typeof global.fetch;

    const res = await POST(
      postRequest({ email: 'alice@example.com', password: 'wrong' }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_credentials');
  });

  it('returns 400 on validation failure', async () => {
    const res = await POST(postRequest({ email: 'not-an-email', password: 'x' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('validation_failed');
  });

  it('returns 400 on malformed JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 502 when Keycloak returns a server error', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 })) as unknown as typeof global.fetch;

    const res = await POST(
      postRequest({ email: 'alice@example.com', password: 'whatever' }),
    );
    expect(res.status).toBe(502);
  });

  it('returns 502 when the Keycloak fetch throws', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof global.fetch;

    const res = await POST(
      postRequest({ email: 'alice@example.com', password: 'whatever' }),
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('upstream_unreachable');
  });
});
