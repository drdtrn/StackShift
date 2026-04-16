import { test, expect } from '@playwright/test';

/**
 * New Alert Rule Builder E2E tests.
 *
 * Walks through the 3-step wizard:
 *   Step 1 — Basic Info (rule name + project)
 *   Step 2 — Condition (type + threshold)
 *   Step 3 — Review + Create Rule
 */

test.describe('new-alert-rule wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/alerts/new');
  });

  test('step 1 — Rule name field is visible', async ({ page }) => {
    await expect(page.getByLabel(/rule name/i)).toBeVisible();
  });

  test('step 1 — clicking Next without a name shows validation error', async ({ page }) => {
    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.getByText(/required|at least/i)).toBeVisible();
  });

  test('step 1 → step 2 — fill rule name and advance', async ({ page }) => {
    await page.getByLabel(/rule name/i).fill('E2E Alert Rule');

    // Wait for projects to load and pick one if a project selector is present
    const projectSelect = page.getByLabel(/project/i).or(page.getByRole('combobox'));
    if (await projectSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select the first option that isn't a placeholder
      const options = await projectSelect.locator('option').all();
      for (const opt of options) {
        const val = await opt.getAttribute('value');
        if (val && val !== '') {
          await projectSelect.selectOption(val);
          break;
        }
      }
    }

    await page.getByRole('button', { name: /next/i }).click();
    // Step 2 — condition type options should appear
    await expect(
      page.getByText(/threshold/i).or(page.getByText(/condition/i)),
    ).toBeVisible();
  });

  test('step 2 → step 3 — advance to review', async ({ page }) => {
    // Step 1
    await page.getByLabel(/rule name/i).fill('E2E Alert Rule');
    const projectSelect = page.getByLabel(/project/i).or(page.getByRole('combobox'));
    if (await projectSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const options = await projectSelect.locator('option').all();
      for (const opt of options) {
        const val = await opt.getAttribute('value');
        if (val && val !== '') {
          await projectSelect.selectOption(val);
          break;
        }
      }
    }
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2 — advance (default condition should be pre-filled)
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3 — Create Rule button should be present
    await expect(page.getByRole('button', { name: /create rule/i })).toBeVisible();
  });

  test('review step — shows the rule name', async ({ page }) => {
    // Step 1
    await page.getByLabel(/rule name/i).fill('My E2E Rule');
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3
    await expect(page.getByText(/my e2e rule/i)).toBeVisible();
  });
});
