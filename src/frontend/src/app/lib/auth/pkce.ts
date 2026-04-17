// ---------------------------------------------------------------------------
// PKCE — Proof Key for Code Exchange
//
// PKCE is the security extension for OAuth2 Authorization Code flow that
// prevents authorization code interception attacks. It works by:
//   1. Generating a random `code_verifier` string.
//   2. Hashing it to produce a `code_challenge` (SHA-256, base64url encoded).
//   3. Sending the `code_challenge` with the authorization request.
//   4. Sending the original `code_verifier` with the token exchange request.
//   5. Keycloak verifies the hash matches — proves the same client made both calls.
//
// Uses the Web Crypto API which is available in both Node.js 18+ (Route
// Handlers) and modern browsers.
// ---------------------------------------------------------------------------

/** Generates a cryptographically random code verifier (43-128 chars, base64url). */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/** Derives the code challenge from a verifier using SHA-256. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/** Generates a cryptographically random nonce (for ID token validation). */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/** Generates a cryptographically random state parameter (CSRF protection). */
export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Encodes a byte array as base64url (no padding, URL-safe).
 * base64url differs from standard base64: uses - and _ instead of + and /,
 * and strips trailing = padding. Required by the PKCE spec (RFC 7636).
 */
function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
