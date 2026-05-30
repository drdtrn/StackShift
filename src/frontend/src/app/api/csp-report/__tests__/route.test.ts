/**
 * @jest-environment node
 */

import { POST } from '@/app/api/csp-report/route';

describe('POST /api/csp-report', () => {
  it('accepts a violation report and returns 204', async () => {
    const request = new Request('http://localhost/api/csp-report', {
      method: 'POST',
      body: JSON.stringify({ 'csp-report': { 'violated-directive': 'script-src' } }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
  });
});
