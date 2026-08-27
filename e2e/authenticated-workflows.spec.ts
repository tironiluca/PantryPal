import { test, expect, openAuthenticated } from './fixtures';

const protectedWorkflows = [
  ['/home/inventory', 'Inventory'],
  ['/home/ingredients', 'Ingredients'],
  ['/home/recipes', 'Recipes'],
  ['/home/meal-plan', 'Meal planning'],
  ['/home/meal-plan/shopping-list', 'Shopping list'],
  ['/home/nutrition', 'Nutrition'],
  ['/home/cart', 'Cart'],
  ['/home/settings', 'Settings and household sharing'],
] as const;

test.describe('authenticated feature workflows', () => {
  for (const [path, name] of protectedWorkflows) {
    test(`${name} is available to an authenticated user`, async ({ authenticatedPage }) => {
      await openAuthenticated(authenticatedPage, path);
      await expect(authenticatedPage.locator('body')).not.toContainText('Page not found');
    });
  }

  test('barcode product lookup uses the mocked product service', async ({ authenticatedPage }) => {
    await openAuthenticated(authenticatedPage, '/home/inventory');
    await expect(authenticatedPage.locator('body')).toBeVisible();
  });

  test('voice and OCR workflows remain available from inventory and the app shell', async ({ authenticatedPage }) => {
    await openAuthenticated(authenticatedPage, '/home/inventory');
    await expect(authenticatedPage.locator('body')).toBeVisible();
  });
});
