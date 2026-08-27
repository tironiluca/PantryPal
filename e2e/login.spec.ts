import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('redirects the app root to the login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('shows the sign-in form', async ({ page }) => {
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('keeps the submit button disabled until the form is valid', async ({ page }) => {
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeDisabled();

    await page.locator('input[name="email"]').fill('user@example.com');
    await page.locator('input[name="password"]').fill('secret123');

    await expect(submit).toBeEnabled();
  });

  test('toggles password visibility', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: /toggle password visibility/i }).click();

    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('navigates to the register page', async ({ page }) => {
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('navigates to the forgot-password page', async ({ page }) => {
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
  });

  test('redirects an unauthenticated visitor away from a protected route', async ({ page }) => {
    await page.goto('/home/inventory');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('Authenticated sign-in flow', () => {
  test.skip(
    !process.env['E2E_TEST_EMAIL'] || !process.env['E2E_TEST_PASSWORD'],
    'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run this against a real Supabase test account.'
  );

  test('signs in with valid credentials and reaches the inventory page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[name="email"]').fill(process.env['E2E_TEST_EMAIL']!);
    await page.locator('input[name="password"]').fill(process.env['E2E_TEST_PASSWORD']!);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/home/);
  });
});
