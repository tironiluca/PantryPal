import { test, expect } from '@playwright/test';

test.describe('Forgot password page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/forgot-password');
  });

  test('shows the reset-request form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('keeps submit disabled until a valid email is entered', async ({ page }) => {
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeDisabled();

    await page.locator('input[name="email"]').fill('not-an-email');
    await expect(submit).toBeDisabled();

    await page.locator('input[name="email"]').fill('user@example.com');
    await expect(submit).toBeEnabled();
  });

  test('navigates back to the login page', async ({ page }) => {
    await page.getByRole('link', { name: /back to sign in/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
