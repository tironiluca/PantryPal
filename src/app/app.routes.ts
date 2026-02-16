import { Routes } from '@angular/router';
import { HomeComponent } from './core/pages/home.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'home',
    component: HomeComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'inventory', pathMatch: 'full' },
      { path: 'inventory', loadChildren: () => import('./features/inventory/inventory.routes').then(m => m.INVENTORY_ROUTES) },
      { path: 'ingredients', loadChildren: () => import('./features/ingredients/ingredients.routes').then(m => m.INGREDIENT_ROUTES) },
      { path: 'recipes', loadChildren: () => import('./features/recipes/recipes.routes').then(m => m.RECIPE_ROUTES) },
      { path: 'cart', loadChildren: () => import('./features/cart/cart.routes').then(m => m.CART_ROUTES) },
      { path: 'settings', loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES) },
    ]
  },
  { path: '**', redirectTo: 'auth/login' }
];
