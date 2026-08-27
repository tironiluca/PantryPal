import { test, expect } from '@playwright/test';

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
  });

  test('shows the sign-up form', async ({ page }) => {
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
  });

  test('keeps submit disabled until all requirements are met', async ({ page }) => {
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeDisabled();

    await page.locator('input[name="email"]').fill('newuser@example.com');
    await page.locator('input[name="password"]').fill('secret123');
    await page.locator('input[name="confirmPassword"]').fill('secret123');
    // Terms checkbox not yet accepted.
    await expect(submit).toBeDisabled();

    await page.getByRole('checkbox').check();
    await expect(submit).toBeEnabled();
  });

  test('keeps submit disabled when passwords do not match', async ({ page }) => {
    await page.locator('input[name="email"]').fill('newuser@example.com');
    await page.locator('input[name="password"]').fill('secret123');
    await page.locator('input[name="confirmPassword"]').fill('different123');
    await page.getByRole('checkbox').check();

    await expect(page.locator('button[type="submit"]')).toBeDisabled();

    // Correcting the confirmation to match unlocks submission.
    await page.locator('input[name="confirmPassword"]').fill('secret123');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('navigates back to the login page', async ({ page }) => {
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
