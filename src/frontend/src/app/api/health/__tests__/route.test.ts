/**
 * @jest-environment node
 */

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  const realFetch = globalThis.fetch;
  const realBackendUrl = process.env.BACKEND_URL;
  const realPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.BACKEND_URL = 'http://backend.test:5190';
    delete process.env.NEXT_PUBLIC_API_URL;
    globalThis.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realBackendUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = realBackendUrl;
    if (realPublicApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = realPublicApiUrl;
    jest.useRealTimers();
  });

  it('returns 200 when the backend is ready', async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test:5190/health/ready',
      expect.objectContaining({ cache: 'no-store' }),
    );
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it('returns 503 when the backend readiness endpoint fails', async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'backend 500' });
  });

  it('returns 503 when the backend readiness request aborts', async () => {
    jest.useFakeTimers();
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));

    const responsePromise = GET();
    await jest.advanceTimersByTimeAsync(801);
    const response = await responsePromise;

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, reason: 'abort' });
  });
});
