import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard - Protects routes that require authentication
 * Redirects to login page if user is not authenticated
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for auth to initialize if still loading
  if (auth.loading()) {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!auth.loading()) {
          clearInterval(interval);
          resolve();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 5000);
    });
  }

  const isAuthenticated = auth.isAuthenticated();

  if (!isAuthenticated) {
    // Store the attempted URL for redirecting after login
    const returnUrl = state.url;
    router.navigate(['/auth/login'], { queryParams: { returnUrl } });
    return false;
  }

  return true;
};

/**
 * Guest Guard - Redirects authenticated users away from auth pages
 * (e.g., if already logged in, redirect from login page to home)
 */
export const guestGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for auth to initialize if still loading
  if (auth.loading()) {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!auth.loading()) {
          clearInterval(interval);
          resolve();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 5000);
    });
  }

  const isAuthenticated = auth.isAuthenticated();

  if (isAuthenticated) {
    // User is already authenticated, redirect to home
    router.navigate(['/home']);
    return false;
  }

  return true;
};
