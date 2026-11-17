import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '../../core/guards/auth.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Sign In - PantryPal',
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard],
    title: 'Sign Up - PantryPal',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
    canActivate: [guestGuard],
    title: 'Reset Password - PantryPal',
  },
  {
    // No guard: the recovery link signs the user in, which guestGuard would redirect away from.
    path: 'reset-password',
    loadComponent: () =>
      import('./reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
    title: 'Choose a New Password - PantryPal',
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
    title: 'Profile - PantryPal',
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
