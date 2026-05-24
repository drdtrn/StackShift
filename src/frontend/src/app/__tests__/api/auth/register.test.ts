/**
 * @jest-environment node
 *
 * Tests for POST /api/auth/register — proxies to the .NET API (NUF-3).
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/register/route';

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const VALID_BODY = {
  email: 'new@example.com',
  password: 'Passw0rd!234',
  displayName: 'New User',
  role: 'viewer' as const,
};

describe('POST /api/auth/register', () => {
  const realFetch = global.fetch;
  const realEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test:5190';
  });

  afterEach(() => {
    global.fetch = realFetch;
    if (realEnv === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = realEnv;
  });

  it('proxies a valid registration to the .NET API and forwards 201', async () => {
    const upstreamBody = JSON.stringify({
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'new@example.com',
      role: 'viewer',
      organizationId: null,
      attachedViaInvitation: false,
    });

    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response(upstreamBody, {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const res = await POST(postRequest(VALID_BODY));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method?: string; body?: string },
    ];
    expect(url).toBe('http://api.test:5190/api/v1/auth/register');
    expect(init.method).toBe('POST');
    const payload = JSON.parse(init.body ?? '') as { isOwner: boolean };
    expect(payload.isOwner).toBe(false);

    expect(res.status).toBe(201);
    expect(await res.text()).toBe(upstreamBody);
  });

  it('maps role=owner to isOwner=true in the upstream payload', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await POST(postRequest({ ...VALID_BODY, role: 'owner' }));
    const init = fetchMock.mock.calls[0][1] as { body?: string };
    const payload = JSON.parse(init.body ?? '') as { isOwner: boolean };
    expect(payload.isOwner).toBe(true);
  });

  it('passes through a 409 from the .NET API verbatim', async () => {
    const body = JSON.stringify({ type: 'about:blank', status: 409, title: 'Conflict' });
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(body, {
          status: 409,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ) as unknown as typeof global.fetch;

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(body);
  });

  it('rejects a malformed body with 400 before hitting upstream', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const res = await POST(postRequest({ email: 'x', password: 'short', displayName: '', role: 'viewer' }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 when the .NET fetch throws', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('refused')) as unknown as typeof global.fetch;

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('upstream_unreachable');
  });
});
