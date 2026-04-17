import { MOCK_USERS } from '@/app/lib/mock-data';
import type { User } from '@/app/types';

// ---------------------------------------------------------------------------
// Mock Auth Provider
//
// Used when NEXT_PUBLIC_AUTH_MOCK=true. Simulates the entire OIDC flow:
//   - generateMockTokens() returns a fake access_token and id_token.
//   - MOCK_AUTH_USER is the user that gets "logged in" (Alice Nguyen, owner).
//
// Token format mirrors real Keycloak JWTs closely enough that session.ts
// can decode them with the same logic — no special-casing needed outside
// this file.
//
// The base64-encoded payloads are NOT cryptographically signed. This is
// acceptable because mock mode is development-only and never runs in prod.
// ---------------------------------------------------------------------------

export const MOCK_AUTH_USER: User = MOCK_USERS[0]; // Alice Nguyen, owner

/** Shapes the realm_access.roles array in the mock Keycloak JWT. */
const MOCK_ROLES = ['Admin', 'stacksift-user'];

/**
 * Generates a fake access_token and id_token in Keycloak's JWT format.
 *
 * Real Keycloak JWTs have three segments: header.payload.signature.
 * The mock tokens use the same structure but the signature is the literal
 * string "mock-signature" — verifiable at a glance in the browser DevTools
 * without needing cryptographic validation.
 */
export function generateMockTokens(): MockTokens {
  const now = Math.floor(Date.now() / 1_000);
  const exp = now + 3_600; // 1-hour expiry

  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT', kid: 'mock-key-id' });

  const accessPayload = base64UrlJson({
    sub: MOCK_AUTH_USER.id,
    iss: 'http://localhost:8080/realms/stacksift',
    aud: 'stacksift-frontend',
    iat: now,
    exp,
    email: MOCK_AUTH_USER.email,
    email_verified: true,
    name: MOCK_AUTH_USER.displayName,
    preferred_username: MOCK_AUTH_USER.email,
    given_name: MOCK_AUTH_USER.displayName.split(' ')[0],
    family_name: MOCK_AUTH_USER.displayName.split(' ').slice(1).join(' '),
    realm_access: { roles: MOCK_ROLES },
    // StackSift custom claims
    organization_id: MOCK_AUTH_USER.organizationId,
    stacksift_role: MOCK_AUTH_USER.role,
  });

  const idPayload = base64UrlJson({
    sub: MOCK_AUTH_USER.id,
    iss: 'http://localhost:8080/realms/stacksift',
    aud: 'stacksift-frontend',
    iat: now,
    exp,
    nonce: 'mock-nonce',
    email: MOCK_AUTH_USER.email,
    email_verified: true,
    name: MOCK_AUTH_USER.displayName,
    preferred_username: MOCK_AUTH_USER.email,
  });

  return {
    access_token: `${header}.${accessPayload}.mock-signature`,
    id_token: `${header}.${idPayload}.mock-signature`,
    refresh_token: `${header}.${base64UrlJson({ sub: MOCK_AUTH_USER.id, type: 'refresh', exp: now + 86_400 })}.mock-signature`,
    token_type: 'Bearer',
    expires_in: 3_600,
    scope: 'openid profile email',
  };
}

/**
 * Generates mock tokens for any user — used when updating the session
 * after organisation creation to inject the new organization_id claim.
 *
 * Accepts a partial User so the caller can override only the fields that
 * changed (e.g. organizationId) while keeping the rest from the original.
 */
export function generateMockTokensForUser(user: User): MockTokens {
  const now = Math.floor(Date.now() / 1_000);
  const exp = now + 3_600;

  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT', kid: 'mock-key-id' });

  const accessPayload = base64UrlJson({
    sub: user.id,
    iss: 'http://localhost:8080/realms/stacksift',
    aud: 'stacksift-frontend',
    iat: now,
    exp,
    email: user.email,
    email_verified: true,
    name: user.displayName,
    preferred_username: user.email,
    given_name: user.displayName.split(' ')[0],
    family_name: user.displayName.split(' ').slice(1).join(' '),
    realm_access: { roles: MOCK_ROLES },
    // Only include organization_id when it is set — absence signals onboarding required
    ...(user.organizationId != null ? { organization_id: user.organizationId } : {}),
    stacksift_role: user.role,
  });

  const idPayload = base64UrlJson({
    sub: user.id,
    iss: 'http://localhost:8080/realms/stacksift',
    aud: 'stacksift-frontend',
    iat: now,
    exp,
    nonce: 'mock-nonce',
    email: user.email,
    email_verified: true,
    name: user.displayName,
    preferred_username: user.email,
  });

  return {
    access_token: `${header}.${accessPayload}.mock-signature`,
    id_token: `${header}.${idPayload}.mock-signature`,
    refresh_token: `${header}.${base64UrlJson({ sub: user.id, type: 'refresh', exp: now + 86_400 })}.mock-signature`,
    token_type: 'Bearer',
    expires_in: 3_600,
    scope: 'openid profile email',
  };
}

/**
 * Extracts the user profile from a mock (or real) access_token.
 * Decodes the JWT payload segment (middle segment, base64url-encoded JSON).
 */
export function extractUserFromToken(accessToken: string): User | null {
  try {
    const [, payloadSegment] = accessToken.split('.');
    if (!payloadSegment) return null;

    // base64url → base64 → JSON
    const padded = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const claims = JSON.parse(json) as TokenClaims;

    return {
      id: claims.sub,
      email: claims.email,
      displayName: claims.name,
      avatarUrl: null,
      role: claims.stacksift_role ?? 'member',
      organizationId: claims.organization_id ?? null,
      createdAt: new Date(claims.iat * 1_000).toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MockTokens {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

interface TokenClaims {
  sub: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
  organization_id?: string;
  stacksift_role?: User['role'];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64UrlJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
