import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom, filter, timeout, catchError, of } from 'rxjs';

/**
 * Waits for AuthService to finish loading using a reactive signal observable.
 * Resolves immediately if already done; times out after 5 s.
 */
const waitForAuthReady = (auth: AuthService): Promise<void> =>
  firstValueFrom(
    toObservable(auth.loading).pipe(
      filter(loading => !loading),
      timeout({ each: 5000 }),
      catchError(() => of(false)),
    )
  ).then(() => void 0);

/**
 * Auth Guard - Protects routes that require authentication
 * Redirects to login page if user is not authenticated
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.loading()) {
    await waitForAuthReady(auth);
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

  if (auth.loading()) {
    await waitForAuthReady(auth);
  }

  const isAuthenticated = auth.isAuthenticated();

  if (isAuthenticated) {
    // User is already authenticated, redirect to home
    router.navigate(['/home']);
    return false;
  }

  return true;
};
