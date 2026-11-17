import { test as plain, expect as plainExpect } from '@playwright/test';
import { test, expect } from './fixtures';

plain.describe('Reset password page without a recovery session', () => {
  plain('explains that the link is invalid and offers a new one', async ({ page }) => {
    await page.goto('/auth/reset-password');
    await plainExpect(page.getByTestId('reset-link-invalid')).toBeVisible();
    await page.getByRole('link', { name: /request a new link/i }).click();
    await plainExpect(page).toHaveURL(/\/auth\/forgot-password/);
  });
});

test.describe('Reset password page with a recovery session', () => {
  test('sets a new password and continues into the app', async ({ authenticatedPage: page }) => {
    let updateBody: unknown = null;
    await page.route('**/auth/v1/user', async (route) => {
      if (route.request().method() === 'PUT') {
        updateBody = route.request().postDataJSON();
      }
      await route.fallback();
    });

    await page.goto('/auth/reset-password');
    const submit = page.getByRole('button', { name: /update password/i });
    await expect(submit).toBeDisabled();

    await page.locator('input[name="password"]').fill('new-secret-1');
    await page.locator('input[name="confirmPassword"]').fill('different');
    await expect(submit).toBeDisabled();

    await page.locator('input[name="confirmPassword"]').fill('new-secret-1');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page).toHaveURL(/\/home/);
    expect(updateBody).toMatchObject({ password: 'new-secret-1' });
  });
});
