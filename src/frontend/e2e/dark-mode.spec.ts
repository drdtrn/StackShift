import { test, expect } from '@playwright/test';

/**
 * Dark-mode / ThemeToggle E2E tests.
 *
 * The ThemeToggle cycles: dark → light → system → dark.
 * Aria-label reflects the *next* action (e.g. "Switch to light mode" when
 * currently in dark mode).
 */

test.describe('dark-mode theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ThemeToggle button is visible', async ({ page }) => {
    // The button's aria-label is one of the NEXT_LABELS values
    const toggle = page.getByRole('button', {
      name: /switch to (light|dark|system) mode/i,
    });
    await expect(toggle).toBeVisible();
  });

  test('clicking ThemeToggle changes its aria-label', async ({ page }) => {
    const toggle = page.getByRole('button', {
      name: /switch to (light|dark|system) mode/i,
    });
    const labelBefore = await toggle.getAttribute('aria-label');
    await toggle.click();
    const labelAfter = await toggle.getAttribute('aria-label');
    expect(labelAfter).not.toBe(labelBefore);
  });

  test('toggling twice gives a different aria-label each time', async ({ page }) => {
    const toggle = page.getByRole('button', {
      name: /switch to (light|dark|system) mode/i,
    });
    const label0 = await toggle.getAttribute('aria-label');
    await toggle.click();
    const label1 = await toggle.getAttribute('aria-label');
    await toggle.click();
    const label2 = await toggle.getAttribute('aria-label');
    // All three should be distinct (cycling dark→light→system)
    const labels = new Set([label0, label1, label2]);
    expect(labels.size).toBe(3);
  });

  test('page content remains visible after toggling theme', async ({ page }) => {
    const toggle = page.getByRole('button', {
      name: /switch to (light|dark|system) mode/i,
    });
    await toggle.click();
    // Main content should still be there — no layout collapse
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /main navigation/i })).toBeVisible();
  });

  test('html element has a class attribute after toggle (theme applied)', async ({ page }) => {
    const toggle = page.getByRole('button', {
      name: /switch to (light|dark|system) mode/i,
    });
    await toggle.click();
    // useThemeEffect applies a class ('dark', 'light', or empty) to <html>
    const htmlClass = await page.locator('html').getAttribute('class');
    // class attribute exists (even if empty string for 'system' → OS-determined)
    expect(htmlClass).not.toBeNull();
  });
});
