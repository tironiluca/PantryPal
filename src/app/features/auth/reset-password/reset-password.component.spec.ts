import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let loading: ReturnType<typeof signal<boolean>>;
  let authenticated: ReturnType<typeof signal<boolean>>;
  let authSpy: { loading: typeof loading; isAuthenticated: typeof authenticated; updatePassword: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    loading = signal(false);
    authenticated = signal(true);
    authSpy = {
      loading,
      isAuthenticated: authenticated,
      updatePassword: vi.fn().mockResolvedValue({ success: true }),
    };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent, MatIconTestingModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: authSpy }],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('shows a progress state while the link is being checked', () => {
    loading.set(true);
    fixture.detectChanges();
    expect(text()).toContain('Checking your reset link');
    expect(component.hasRecoverySession()).toBe(false);
  });

  it('explains an invalid or expired link when no recovery session exists', () => {
    authenticated.set(false);
    fixture.detectChanges();
    expect(text()).toContain('invalid or has expired');
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/auth/forgot-password"]')).not.toBeNull();
  });

  it('shows the new-password form when the recovery session is present', () => {
    expect(component.hasRecoverySession()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('input[name="password"]')).not.toBeNull();
  });

  it('blocks submission for short or mismatched passwords', async () => {
    component.password = '12345';
    component.confirmPassword = '12345';
    expect(component.canSubmit()).toBe(false);

    component.password = 'longenough';
    component.confirmPassword = 'different';
    expect(component.canSubmit()).toBe(false);
    await component.onSubmit();
    expect(authSpy.updatePassword).not.toHaveBeenCalled();
  });

  it('updates the password and goes home on success', async () => {
    component.password = 'new-secret';
    component.confirmPassword = 'new-secret';
    await component.onSubmit();
    expect(authSpy.updatePassword).toHaveBeenCalledWith('new-secret');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(component.saving()).toBe(false);
  });

  it('stays on the page when the update fails', async () => {
    authSpy.updatePassword.mockResolvedValue({ success: false, error: 'weak' });
    component.password = 'new-secret';
    component.confirmPassword = 'new-secret';
    await component.onSubmit();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });

  it('toggles password visibility', () => {
    expect(component.hidePassword()).toBe(true);
    component.hidePassword.set(false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('input[name="password"]')?.getAttribute('type')).toBe('text');
  });
});
