import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'inventory', pathMatch: 'full' },
  { path: 'inventory', loadChildren: () => import('./features/inventory/inventory.routes').then(m => m.INVENTORY_ROUTES) },
  { path: 'ingredients', loadChildren: () => import('./features/ingredients/ingredients.routes').then(m => m.INGREDIENT_ROUTES) },
  { path: 'recipes', loadChildren: () => import('./features/recipes/recipes.routes').then(m => m.RECIPE_ROUTES) },
  { path: 'cart', loadChildren: () => import('./features/cart/cart.routes').then(m => m.CART_ROUTES) },
  { path: 'settings', loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES) },
  { path: '**', redirectTo: 'inventory' }
];
