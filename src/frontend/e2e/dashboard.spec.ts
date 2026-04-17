import { test, expect } from '@playwright/test';

/**
 * Dashboard E2E tests.
 *
 * Verifies the Overview page loads, metric cards are present, and the
 * sidebar navigation is visible. Mock auth is active so no login needed.
 */

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page title contains StackSift', async ({ page }) => {
    await expect(page).toHaveTitle(/stacksift/i);
  });

  test('Overview heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();
  });

  test('Active Alerts metric card is present', async ({ page }) => {
    await expect(page.getByText(/active alerts/i)).toBeVisible();
  });

  test('Total Logs Today metric card is present', async ({ page }) => {
    await expect(page.getByText(/total logs today/i)).toBeVisible();
  });

  test('Open Incidents metric card is present', async ({ page }) => {
    await expect(page.getByText(/open incidents/i)).toBeVisible();
  });

  test('sidebar navigation links are visible', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav.getByRole('link', { name: /log explorer/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /alerts/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /projects/i })).toBeVisible();
  });
});
