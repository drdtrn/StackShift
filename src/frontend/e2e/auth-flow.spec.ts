import { test, expect } from '@playwright/test';

/**
 * Auth-flow E2E tests.
 *
 * With NEXT_PUBLIC_AUTH_MOCK=true the server auto-authenticates every request
 * using Alice Nguyen's mock session, so protected routes are accessible without
 * a real login. The /login page is still reachable directly.
 */

test.describe('auth-flow', () => {
  test('login page renders the sign-in button', async ({ page }) => {
    await page.goto('/login');
    // The login page should have a button/link that initiates the OAuth flow
    const signInButton = page.getByRole('button', { name: /sign in/i }).or(
      page.getByRole('link', { name: /sign in/i }),
    );
    await expect(signInButton).toBeVisible();
  });

  test('navigating to / shows the dashboard (mock auth active)', async ({ page }) => {
    await page.goto('/');
    // The dashboard renders — at minimum the main heading "Overview" is visible
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();
  });

  test('dashboard has the main navigation sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: /main navigation/i })).toBeVisible();
  });
});
