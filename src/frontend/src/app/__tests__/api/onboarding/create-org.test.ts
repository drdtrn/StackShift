/**
 * @jest-environment node
 *
 * Tests for POST /api/onboarding/create-org
 *
 * The route handler:
 *   - Returns 401 when no session cookie is present
 *   - Returns 400 when the request body is invalid (missing, short, bad chars)
 *   - Returns 201 with an Organization object on success
 *   - Sets an updated session cookie with the new organization_id
 *   - Generates a correct URL-safe slug from the org name
 */

import { NextRequest } from 'next/server';
import { POST, nameToSlug } from '@/app/api/onboarding/create-org/route';
import { MOCK_AUTH_USER, generateMockTokensForUser } from '@/app/lib/auth/mock';
import { createSessionCookie } from '@/app/lib/auth/session';
import type { Organization } from '@/app/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a NextRequest with an optional session cookie and JSON body. */
function makeRequest(body: unknown, sessionCookie?: string): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionCookie) {
    headers['cookie'] = sessionCookie;
  }
  return new NextRequest('http://localhost:3000/api/onboarding/create-org', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** Generates a valid mock session cookie for MOCK_AUTH_USER. */
function getValidSessionCookie(): string {
  // Use a user WITHOUT an org so this is a valid onboarding scenario.
  const tokens = generateMockTokensForUser({ ...MOCK_AUTH_USER, organizationId: null });
  const cookieHeader = createSessionCookie(tokens);
  // Extract just the name=value part for the Cookie request header
  return cookieHeader.split(';')[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/onboarding/create-org', () => {
  describe('authentication', () => {
    it('returns 401 when no session cookie is present', async () => {
      const req = makeRequest({ name: 'Acme Corp' });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('unauthenticated');
    });
  });

  describe('validation', () => {
    it('returns 400 when name is missing from body', async () => {
      const cookie = getValidSessionCookie();
      const req = makeRequest({}, cookie);
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('validation_failed');
    });

    it('returns 400 when name is too short (< 2 chars)', async () => {
      const cookie = getValidSessionCookie();
      const req = makeRequest({ name: 'A' }, cookie);
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when name is too long (> 50 chars)', async () => {
      const cookie = getValidSessionCookie();
      const req = makeRequest({ name: 'A'.repeat(51) }, cookie);
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when name contains invalid characters (!@#)', async () => {
      const cookie = getValidSessionCookie();
      const req = makeRequest({ name: 'Bad!Org' }, cookie);
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when name starts with a space', async () => {
      const cookie = getValidSessionCookie();
      const req = makeRequest({ name: ' Acme' }, cookie);
      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  describe('success', () => {
    it('returns 201 with an Organization object', async () => {
      const cookie = getValidSessionCookie();
      const req = makeRequest({ name: 'Acme Corp' }, cookie);
      const res = await POST(req);

      expect(res.status).toBe(201);
      const org = await res.json() as Organization;
      expect(org.name).toBe('Acme Corp');
      expect(org.slug).toBe('acme-corp');
      expect(typeof org.id).toBe('string');
      expect(typeof org.createdAt).toBe('string');
      expect(org.logoUrl).toBeNull();
    });

    it('sets an updated session cookie in the response', async () => {
      const cookie = getValidSessionCookie();
      const req = makeRequest({ name: 'Nexus Labs' }, cookie);
      const res = await POST(req);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).not.toBeNull();
      expect(setCookie).toContain('stacksift_session=');
      expect(setCookie).toContain('HttpOnly');
    });

    it('accepts a name with spaces and hyphens', async () => {
      const cookie = getValidSessionCookie();
      const req = makeRequest({ name: 'My Cool-Org' }, cookie);
      const res = await POST(req);

      expect(res.status).toBe(201);
    });
  });
});

// ---------------------------------------------------------------------------
// nameToSlug utility
// ---------------------------------------------------------------------------

describe('nameToSlug', () => {
  it('lowercases the name', () => {
    expect(nameToSlug('Acme')).toBe('acme');
  });

  it('replaces spaces with hyphens', () => {
    expect(nameToSlug('Acme Corp')).toBe('acme-corp');
  });

  it('collapses multiple spaces to a single hyphen', () => {
    expect(nameToSlug('Acme   Corp')).toBe('acme-corp');
  });

  it('strips trailing hyphens', () => {
    expect(nameToSlug('Acme Corp-')).toBe('acme-corp');
  });

  it('handles names with existing hyphens', () => {
    expect(nameToSlug('Hello-World')).toBe('hello-world');
  });
});
