import { test, expect } from '@playwright/test';

/**
 * Auth-flow E2E tests.
 *
 * With NEXT_PUBLIC_AUTH_MOCK=true the server auto-authenticates every request
 * using Alice Nguyen's mock session, so protected routes are accessible without
 * a real login. The /login page is still reachable directly.
 */

test.describe('auth-flow · mock', () => {
  test('login page renders the sign-in button', async ({ page }) => {
    await page.goto('/login');
    const signInButton = page.getByRole('button', { name: /sign in/i }).or(
      page.getByRole('link', { name: /sign in/i }),
    );
    await expect(signInButton).toBeVisible();
  });

  test('navigating to / shows the dashboard (mock auth active)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();
  });

  test('dashboard has the main navigation sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: /main navigation/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Real-Keycloak auth flow
//
// Requires:
//   - docker compose up postgres keycloak  (realm imported)
//   - admin-user password reset to E2E_KC_PASSWORD (see docs/auth-flow.md)
//   - pnpm dev running with NEXT_PUBLIC_AUTH_MOCK=false
//
// Activated by: E2E_REAL_AUTH=true pnpm test:e2e -- auth-flow
// Skipped by default so CI (which boots the dev server with mock auth) stays green.
// ---------------------------------------------------------------------------

const REAL_AUTH = process.env.E2E_REAL_AUTH === 'true';
const KC_PASSWORD = process.env.E2E_KC_PASSWORD ?? 'password123';

test.describe('auth-flow · real Keycloak', () => {
  test.skip(!REAL_AUTH, 'Set E2E_REAL_AUTH=true with a real Keycloak + pnpm dev (NEXT_PUBLIC_AUTH_MOCK=false) to run');

  test('user can log in via Keycloak and lands on the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/realms\/stacksift\/protocol\/openid-connect\/auth/, {
      timeout: 10_000,
    });
    await page.getByLabel(/username/i).fill('admin-user');
    await page.getByLabel(/password/i).fill(KC_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();
  });

  test('session cookie is HttpOnly and carries no JWT in Web Storage', async ({ page, context }) => {
    await page.goto('/');

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'stacksift_session');
    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe('Lax');

    const ls = await page.evaluate(() => JSON.stringify(localStorage));
    const ss = await page.evaluate(() => JSON.stringify(sessionStorage));
    const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}/;
    expect(ls).not.toMatch(jwtPattern);
    expect(ss).not.toMatch(jwtPattern);
  });

  test('/api/auth/token returns a valid access token', async ({ request }) => {
    const res = await request.get('/api/auth/token');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { accessToken: string };
    expect(body.accessToken).toMatch(/^eyJ/);
  });

  test('logout clears the session cookie', async ({ page, context }) => {
    await page.goto('/api/auth/logout');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'stacksift_session');
    expect(session?.value ?? '').toBe('');
  });
});
