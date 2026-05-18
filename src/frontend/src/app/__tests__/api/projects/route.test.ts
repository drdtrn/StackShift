/**
 * @jest-environment node
 *
 * Tests for POST /api/projects
 *
 * The route handler:
 *   - Returns 401 when no session cookie is present
 *   - Returns 400 when the body is invalid JSON
 *   - Returns 400 when name is missing
 *   - Returns 400 when name is too short or too long
 *   - Returns 400 when logSourceConfig is missing
 *   - Returns 400 when Application endpoint is not a URL
 *   - Returns 201 with a Project object on success
 *   - Generated project has correct shape (id, name, slug, organizationId)
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/projects/route';
import { MOCK_AUTH_USER, generateMockTokensForUser } from '@/app/lib/auth/mock';
import { createSessionCookie } from '@/app/lib/auth/session';
import type { Project } from '@/app/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, sessionCookie?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionCookie) headers['cookie'] = sessionCookie;
  return new NextRequest('http://localhost:3000/api/projects', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function getValidSessionCookie(): string {
  const user = { ...MOCK_AUTH_USER, organizationId: 'org-001' };
  const tokens = generateMockTokensForUser(user);
  return createSessionCookie(tokens).split(';')[0];
}

const VALID_BODY = {
  name: 'API Gateway',
  description: 'Main API',
  logSourceConfig: { type: 'Application', endpoint: 'https://api.example.com/logs' },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/projects — authentication', () => {
  it('returns 401 when no session cookie is present', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('unauthenticated');
  });
});

describe('POST /api/projects — validation', () => {
  it('returns 400 when name is missing', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({ logSourceConfig: VALID_BODY.logSourceConfig }, cookie));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('validation_failed');
  });

  it('returns 400 when name is too short (< 3 chars)', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({ ...VALID_BODY, name: 'AB' }, cookie));
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is too long (> 50 chars)', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({ ...VALID_BODY, name: 'A'.repeat(51) }, cookie));
    expect(res.status).toBe(400);
  });

  it('returns 400 when logSourceConfig is missing', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({ name: 'API Gateway' }, cookie));
    expect(res.status).toBe(400);
  });

  it('returns 400 when Application endpoint is not a valid URL', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      ...VALID_BODY,
      logSourceConfig: { type: 'Application', endpoint: 'not-a-url' },
    }, cookie));
    expect(res.status).toBe(400);
  });

  it('returns 400 when Infrastructure filePath is empty', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      ...VALID_BODY,
      logSourceConfig: { type: 'Infrastructure', filePath: '' },
    }, cookie));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/projects — success', () => {
  it('returns 201 with a Project object', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest(VALID_BODY, cookie));
    expect(res.status).toBe(201);

    const project = await res.json() as Project;
    expect(project.name).toBe('API Gateway');
    expect(project.description).toBe('Main API');
    expect(typeof project.id).toBe('string');
    expect(project.slug).toBe('api-gateway');
    expect(typeof project.createdAt).toBe('string');
  });

  it('sets logSourceCount to 1 for a new project', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest(VALID_BODY, cookie));
    const project = await res.json() as Project;
    expect(project.logSourceCount).toBe(1);
  });

  it('accepts Infrastructure log source type', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      name: 'Infra Monitor',
      logSourceConfig: { type: 'Infrastructure', filePath: '/var/log/app.log' },
    }, cookie));
    expect(res.status).toBe(201);
    const project = await res.json() as Project;
    expect(project.name).toBe('Infra Monitor');
  });

  it('accepts Custom log source type', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      name: 'Custom Monitor',
      logSourceConfig: { type: 'Custom', customDescription: 'Syslog via UDP' },
    }, cookie));
    expect(res.status).toBe(201);
  });

  it('generates a URL-safe slug from the project name', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({ ...VALID_BODY, name: 'My Cool Project' }, cookie));
    const project = await res.json() as Project;
    expect(project.slug).toBe('my-cool-project');
  });
});
