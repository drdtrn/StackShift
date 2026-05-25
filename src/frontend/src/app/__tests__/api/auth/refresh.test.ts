/**
 * @jest-environment node
 *
 * Tests for POST /api/auth/refresh
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/refresh/route';

const mockReadSessionCookie = jest.fn();
const mockRefreshSession = jest.fn();
const mockCreateSessionCookie = jest.fn();
const mockClearSessionCookie = jest.fn();

jest.mock('@/app/lib/auth/session', () => ({
  readSessionCookie: (...args: unknown[]) => mockReadSessionCookie(...args),
  refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
  createSessionCookie: (...args: unknown[]) => mockCreateSessionCookie(...args),
  clearSessionCookie: () => mockClearSessionCookie(),
}));

const mockSession = {
  accessToken: 'old-access',
  idToken: 'old-id',
  refreshToken: 'old-refresh',
  expiresAt: Math.floor(Date.now() / 1_000) + 300,
};

const mockRefreshedSession = {
  accessToken: 'new-access',
  idToken: 'new-id',
  refreshToken: 'new-refresh',
  expiresAt: Math.floor(Date.now() / 1_000) + 600,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateSessionCookie.mockReturnValue('stacksift_session=new-value; Path=/; HttpOnly');
  mockClearSessionCookie.mockReturnValue('stacksift_session=; Path=/; Max-Age=0; HttpOnly');
});

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/refresh', { method: 'POST' });
}

describe('POST /api/auth/refresh', () => {
  it('returns 401 when no session cookie is present', async () => {
    mockReadSessionCookie.mockReturnValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('returns 200 and sets rotated session cookie on successful refresh', async () => {
    mockReadSessionCookie.mockReturnValue(mockSession);
    mockRefreshSession.mockResolvedValue(mockRefreshedSession);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockCreateSessionCookie).toHaveBeenCalledWith(mockRefreshedSession);
    expect(res.headers.get('Set-Cookie')).toContain('stacksift_session=new-value');
  });

  it('returns 401 and clears cookie when refresh token is expired', async () => {
    mockReadSessionCookie.mockReturnValue(mockSession);
    mockRefreshSession.mockResolvedValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('session_expired');
    expect(mockClearSessionCookie).toHaveBeenCalled();
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
