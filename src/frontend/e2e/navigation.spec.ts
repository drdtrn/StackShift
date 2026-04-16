import { test, expect } from '@playwright/test';

/**
 * Navigation E2E tests.
 *
 * Verifies that clicking sidebar links lands on the correct page and
 * that the browser URL updates accordingly.
 */

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clicking Logs navigates to /logs', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('link', { name: /log explorer/i }).click();
    await expect(page).toHaveURL(/\/logs/);
  });

  test('clicking Projects navigates to /projects', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('link', { name: /projects/i }).click();
    await expect(page).toHaveURL(/\/projects/);
  });

  test('clicking Alert Rules navigates to /alerts', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('link', { name: /alert rules/i }).click();
    await expect(page).toHaveURL(/\/alerts/);
  });

  test('clicking Incidents navigates to /incidents', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('link', { name: /incidents/i }).click();
    await expect(page).toHaveURL(/\/incidents/);
  });

  test('/projects/new page is reachable and shows the project wizard', async ({ page }) => {
    await page.goto('/projects/new');
    // The wizard renders with a step indicator or heading
    await expect(
      page.getByRole('heading', { name: /new project/i }).or(
        page.getByText(/step 1/i),
      ),
    ).toBeVisible();
  });
});
