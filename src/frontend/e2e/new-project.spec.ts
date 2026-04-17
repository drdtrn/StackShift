import { test, expect } from '@playwright/test';

/**
 * New Project Wizard E2E tests.
 *
 * Walks through the 3-step wizard:
 *   Step 1 — Basic Info (name + description)
 *   Step 2 — Log Source (type + endpoint)
 *   Step 3 — Review + Create
 *
 * The mutation stub (NEXT_PUBLIC_AUTH_MOCK) returns a fake project so
 * navigation to /projects/:id is expected on success.
 */

test.describe('new-project wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/new');
  });

  test('step 1 — Project name field is visible', async ({ page }) => {
    await expect(page.getByLabel(/project name/i)).toBeVisible();
  });

  test('step 1 — clicking Next without a name shows a validation error', async ({ page }) => {
    await page.getByRole('button', { name: /next/i }).click();
    // Validation error should appear
    await expect(page.getByText(/required|at least|name/i)).toBeVisible();
  });

  test('step 1 → step 2 — fill name and advance', async ({ page }) => {
    await page.getByLabel(/project name/i).fill('E2E Test Project');
    await page.getByRole('button', { name: /next/i }).click();
    // Step 2 should be visible — log source type selector or heading
    await expect(
      page.getByText(/log source/i).or(page.getByText(/endpoint/i)),
    ).toBeVisible();
  });

  test('step 2 → step 3 — advance to review', async ({ page }) => {
    // Fill step 1
    await page.getByLabel(/project name/i).fill('E2E Test Project');
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2 — fill endpoint and advance
    const endpointInput = page.getByLabel(/endpoint/i).or(page.getByPlaceholder(/endpoint|http/i));
    if (await endpointInput.isVisible()) {
      await endpointInput.fill('http://myapp.local/logs');
    }
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3 review page should show the project name
    await expect(page.getByText(/e2e test project/i)).toBeVisible();
  });

  test('review step — Create Project button is present', async ({ page }) => {
    // Advance through steps 1 and 2
    await page.getByLabel(/project name/i).fill('Review Test');
    await page.getByRole('button', { name: /next/i }).click();

    const endpointInput = page.getByLabel(/endpoint/i).or(page.getByPlaceholder(/endpoint|http/i));
    if (await endpointInput.isVisible()) {
      await endpointInput.fill('http://example.com/logs');
    }
    await page.getByRole('button', { name: /next/i }).click();

    // Create Project button should be on last step
    await expect(page.getByRole('button', { name: /create project/i })).toBeVisible();
  });
});
