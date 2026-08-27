import { test, expect, openAuthenticated, supabaseProjectRef } from './fixtures';

test.describe('authenticated failure workflows', () => {
  test('survives a failed backend save without leaving the protected route', async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/rest/v1/**', route => route.fulfill({ status: 500, body: 'database unavailable' }));
    await openAuthenticated(authenticatedPage, '/home/inventory');
    await expect(authenticatedPage).not.toHaveURL(/\/auth\/login/);
    await expect(authenticatedPage.locator('body')).toBeVisible();
  });

  test('survives product lookup failure', async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/world.openfoodfacts.org/**', route => route.abort('failed'));
    await openAuthenticated(authenticatedPage, '/home/inventory');
    await expect(authenticatedPage.locator('body')).toBeVisible();
  });

  test('keeps permission-denied workflows on the protected shell', async ({ browser }) => {
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await page.addInitScript((projectRef) => {
      localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify({
        access_token: 'e2e-access-token',
        refresh_token: 'e2e-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'e2e-user-1', email: 'pantrypal-e2e@example.test' },
      }));
    }, supabaseProjectRef);
    await page.goto('/home/inventory');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await context.close();
  });
});
