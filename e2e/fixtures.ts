import { test as base, expect, Page } from '@playwright/test';

const testUser = {
  id: 'e2e-user-1',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'pantrypal-e2e@example.test',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  app_metadata: { provider: 'email' },
  user_metadata: { display_name: 'E2E User' },
};

const testSession = {
  access_token: 'e2e-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'e2e-refresh-token',
  user: testUser,
};

const configuredSupabaseUrl = process.env['SUPABASE_URL'] ?? 'https://YOUR_PROJECT_REF.supabase.co';
const supabaseProjectRef = configuredSupabaseUrl.split('//')[1]?.split('.')[0] || 'YOUR_PROJECT_REF';

export interface AuthenticatedFixtures {
  authenticatedPage: Page;
}

export const test = base.extend<AuthenticatedFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.addInitScript(({ session, projectRef }) => {
      localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(session));
    }, { session: testSession, projectRef: supabaseProjectRef });

    await page.route('**/auth/v1/**', async route => {
      const url = route.request().url();
      if (url.includes('/token')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testSession) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: testSession, user: testUser }) });
    });

    await page.route('**/rest/v1/**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    });

    await page.route('**/world.openfoodfacts.org/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 1, product: { product_name: 'E2E Product', nutriments: {} } }),
      });
    });

    await use(page);
  },
});

export { expect, supabaseProjectRef, testSession, testUser };

export async function openAuthenticated(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).not.toHaveURL(/\/auth\/login/);
}
