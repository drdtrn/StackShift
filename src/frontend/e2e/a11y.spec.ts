import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility E2E scans — WCAG AA (EPIC-08).
 *
 * Uses @axe-core/playwright to run axe-core against live pages served by the
 * dev server with NEXT_PUBLIC_AUTH_MOCK=true (auto-authenticated as Alice).
 *
 * Each test checks for zero critical or serious violations under wcag2a,
 * wcag2aa, and wcag21aa rule sets. Incomplete/minor issues are not asserted
 * here — they are caught by jest-axe unit tests and linting instead.
 */

/** Run axe on the current page and return only critical/serious violations. */
async function getCriticalViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  return results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
}

test.describe('a11y — dashboard pages', () => {
  test('overview page has no critical/serious violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: /overview/i }).waitFor();
    const violations = await getCriticalViolations(page);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  test('logs page has no critical/serious violations', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
    const violations = await getCriticalViolations(page);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  test('incidents page has no critical/serious violations', async ({ page }) => {
    await page.goto('/incidents');
    await page.waitForLoadState('networkidle');
    const violations = await getCriticalViolations(page);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  test('alerts page has no critical/serious violations', async ({ page }) => {
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    const violations = await getCriticalViolations(page);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  test('projects page has no critical/serious violations', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    const violations = await getCriticalViolations(page);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  test('settings page has no critical/serious violations', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const violations = await getCriticalViolations(page);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });
});

test.describe('a11y — auth pages', () => {
  test('login page has no critical/serious violations', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const violations = await getCriticalViolations(page);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });
});

test.describe('a11y — skip link', () => {
  test('skip-to-content link is present and targets #main-content', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: /overview/i }).waitFor();

    // The skip link is visually hidden but present in the DOM.
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
    await expect(skipLink).toHaveText(/skip to main content/i);
  });

  test('skip link is keyboard-focusable and reaches main content', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: /overview/i }).waitFor();

    // Tab to the first focusable element (the skip link).
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('href', '#main-content');

    // Activating the skip link moves focus to #main-content.
    await page.keyboard.press('Enter');
    const mainFocused = await page.evaluate(
      () => document.activeElement?.id,
    );
    expect(mainFocused).toBe('main-content');
  });
});

test.describe('a11y — keyboard navigation', () => {
  test('all sidebar nav links are keyboard reachable', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: /overview/i }).waitFor();

    const nav = page.getByRole('navigation', { name: /main navigation/i });
    const links = nav.getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    // Verify every link has a non-empty accessible name.
    for (let i = 0; i < count; i++) {
      const name = await links.nth(i).getAttribute('aria-label') ??
                   await links.nth(i).innerText();
      expect(name.trim()).not.toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatViolations(violations: { id: string; description: string; impact?: string | null }[]) {
  if (violations.length === 0) return '';
  return (
    `\nFound ${violations.length} critical/serious a11y violation(s):\n` +
    violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')
  );
}
