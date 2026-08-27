import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('auth guards', () => {
  let router: { navigate: ReturnType<typeof vi.fn> };
  let auth: {
    loading: ReturnType<typeof signal<boolean>>;
    isAuthenticated: ReturnType<typeof signal<boolean>>;
  };

  beforeEach(() => {
    router = { navigate: vi.fn() };
    auth = { loading: signal(false), isAuthenticated: signal(false) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('redirects unauthenticated users and preserves the return URL', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/home/inventory' } as never)
    );

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/home/inventory' },
    });
  });

  it('allows authenticated users through the auth guard', async () => {
    auth.isAuthenticated.set(true);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/home' } as never)
    );

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects authenticated users away from guest routes', async () => {
    auth.isAuthenticated.set(true);

    const result = await TestBed.runInInjectionContext(() =>
      guestGuard({} as never, { url: '/auth/login' } as never)
    );

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });
});
