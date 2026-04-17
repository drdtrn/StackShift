// ---------------------------------------------------------------------------
// Auth Configuration
//
// Single source of truth for all Keycloak OIDC settings.
// Values are read from environment variables — never hardcoded.
//
// MOCK MODE (NEXT_PUBLIC_AUTH_MOCK=true):
//   Bypasses real Keycloak calls. The entire OIDC flow is simulated
//   with fake tokens so the frontend is fully testable without Docker.
//   Flip to false when the Keycloak DevOps task is complete.
// ---------------------------------------------------------------------------

const keycloakUrl =
  process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? 'http://localhost:8080';
const realm =
  process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? 'stacksift';
const clientId =
  process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'stacksift-frontend';

// The base URL of the Next.js app — used to construct redirect_uri.
// In production this would be the deployed URL.
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const authConfig = {
  // Whether to use mock auth (no real Keycloak required)
  mockMode: process.env.NEXT_PUBLIC_AUTH_MOCK === 'true',

  // Keycloak realm base URL
  realmUrl: `${keycloakUrl}/realms/${realm}`,

  // OIDC endpoint URLs (standard Keycloak paths)
  endpoints: {
    authorize: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth`,
    token: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`,
    logout: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/logout`,
    userinfo: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/userinfo`,
    jwks: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
  },

  // OAuth2 client settings
  clientId,

  // Where Keycloak sends the user after authentication.
  // Must match what is registered in the Keycloak client's "Valid redirect URIs".
  redirectUri: `${appUrl}/api/auth/callback`,

  // OIDC scopes requested
  scopes: ['openid', 'profile', 'email'],

  // Cookie names
  cookies: {
    // Short-lived cookie that holds PKCE state during the auth redirect.
    // Name matches the state value so multiple concurrent logins don't collide.
    pkcePrefix: 'stacksift_pkce_',
    // Long-lived session cookie set after successful token exchange.
    session: 'stacksift_session',
  },

  // Session duration (1 day in seconds)
  sessionMaxAge: 60 * 60 * 24,
} as const;
