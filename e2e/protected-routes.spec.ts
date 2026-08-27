import { test, expect } from '@playwright/test';

const protectedRoutes = [
  '/home',
  '/home/inventory',
  '/home/ingredients',
  '/home/recipes',
  '/home/meal-plan',
  '/home/nutrition',
  '/home/cart',
  '/home/settings',
];

test.describe('Protected route access', () => {
  for (const route of protectedRoutes) {
    test(`redirects unauthenticated visitors from ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  }
});
