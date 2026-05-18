/**
 * @jest-environment node
 *
 * Tests for POST /api/alert-rules
 *
 * The route handler:
 *   - Returns 401 when no session cookie is present
 *   - Returns 400 when the body fails Zod validation
 *   - Returns 201 with an AlertRule for each of the 4 condition types
 *   - Maps form condition types to domain AlertRule fields correctly
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/alert-rules/route';
import { MOCK_AUTH_USER, generateMockTokensForUser } from '@/app/lib/auth/mock';
import { createSessionCookie } from '@/app/lib/auth/session';
import type { AlertRule } from '@/app/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, sessionCookie?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionCookie) headers['cookie'] = sessionCookie;
  return new NextRequest('http://localhost:3000/api/alert-rules', {
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

const BASE = {
  name: 'High error rate',
  projectId: 'proj-001',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/alert-rules — authentication', () => {
  it('returns 401 when no session cookie is present', async () => {
    const res = await POST(makeRequest({ ...BASE, condition: { type: 'ErrorRate', threshold: 5, windowMinutes: 15 } }));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('unauthenticated');
  });
});

describe('POST /api/alert-rules — validation', () => {
  it('returns 400 when name is missing', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      projectId: 'proj-001',
      condition: { type: 'ErrorRate', threshold: 5, windowMinutes: 15 },
    }, cookie));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('validation_failed');
  });

  it('returns 400 when name is too short (< 3 chars)', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      ...BASE,
      name: 'AB',
      condition: { type: 'ErrorRate', threshold: 5, windowMinutes: 15 },
    }, cookie));
    expect(res.status).toBe(400);
  });

  it('returns 400 when projectId is missing', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      name: 'High error rate',
      condition: { type: 'ErrorRate', threshold: 5, windowMinutes: 15 },
    }, cookie));
    expect(res.status).toBe(400);
  });

  it('returns 400 when condition is missing', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({ ...BASE }, cookie));
    expect(res.status).toBe(400);
  });

  it('returns 400 when ErrorRate threshold exceeds 100', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      ...BASE,
      condition: { type: 'ErrorRate', threshold: 101, windowMinutes: 15 },
    }, cookie));
    expect(res.status).toBe(400);
  });

  it('returns 400 when PatternMatch pattern is empty', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      ...BASE,
      condition: { type: 'PatternMatch', pattern: '' },
    }, cookie));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/alert-rules — success (ErrorRate)', () => {
  it('returns 201 with an AlertRule', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      ...BASE,
      condition: { type: 'ErrorRate', threshold: 5, windowMinutes: 15 },
    }, cookie));
    expect(res.status).toBe(201);
    const rule = await res.json() as AlertRule;
    expect(rule.name).toBe('High error rate');
    expect(rule.projectId).toBe('proj-001');
    expect(rule.condition).toBe('threshold');
    expect(rule.threshold).toBe(5);
    expect(rule.windowMinutes).toBe(15);
    expect(rule.isActive).toBe(true);
  });
});

describe('POST /api/alert-rules — success (LogVolume)', () => {
  it('returns 201 with threshold condition', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      ...BASE,
      condition: { type: 'LogVolume', threshold: 100, windowMinutes: 60 },
    }, cookie));
    expect(res.status).toBe(201);
    const rule = await res.json() as AlertRule;
    expect(rule.condition).toBe('threshold');
    expect(rule.threshold).toBe(100);
    expect(rule.windowMinutes).toBe(60);
  });
});

describe('POST /api/alert-rules — success (PatternMatch)', () => {
  it('returns 201 with pattern condition', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      ...BASE,
      condition: { type: 'PatternMatch', pattern: 'ERROR.*database', logLevel: 'error' },
    }, cookie));
    expect(res.status).toBe(201);
    const rule = await res.json() as AlertRule;
    expect(rule.condition).toBe('pattern');
    expect(rule.pattern).toBe('ERROR.*database');
    expect(rule.logLevel).toBe('error');
  });

  it('accepts PatternMatch without an optional logLevel', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      ...BASE,
      condition: { type: 'PatternMatch', pattern: 'timeout' },
    }, cookie));
    expect(res.status).toBe(201);
    const rule = await res.json() as AlertRule;
    expect(rule.logLevel).toBeNull();
  });
});

describe('POST /api/alert-rules — success (Latency)', () => {
  it('returns 201 with threshold condition for Latency type', async () => {
    const cookie = getValidSessionCookie();
    const res = await POST(makeRequest({
      ...BASE,
      condition: { type: 'Latency', thresholdMs: 500, percentile: 95 },
    }, cookie));
    expect(res.status).toBe(201);
    const rule = await res.json() as AlertRule;
    expect(rule.condition).toBe('threshold');
    expect(rule.threshold).toBe(500);
  });
});
