/**
 * @jest-environment node
 */

import { GET } from '@/app/api/healthz/route';

describe('GET /api/healthz', () => {
  it('returns 200 without calling dependencies', async () => {
    const realFetch = globalThis.fetch;
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const response = GET();

      expect(response.status).toBe(200);
      expect(fetchMock).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({ ok: true });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
