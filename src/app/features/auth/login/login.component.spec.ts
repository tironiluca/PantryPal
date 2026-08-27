import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authSpy: { signIn: ReturnType<typeof vi.fn>; signInWithOAuth: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authSpy = {
      signIn: vi.fn().mockResolvedValue({ success: true }),
      signInWithOAuth: vi.fn().mockResolvedValue(undefined),
    };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [
        LoginComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // Template-driven forms (ngModel/ngForm) register their controls
    // asynchronously, so give validity a tick to settle before assertions.
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('starts with an empty, disabled form', () => {
    const submitButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('does not attempt to sign in when email or password is missing', async () => {
    component.email = '';
    component.password = '';

    await component.onSubmit();

    expect(authSpy.signIn).not.toHaveBeenCalled();
  });

  it('signs in and navigates home on success', async () => {
    component.email = 'user@example.com';
    component.password = 'secret123';

    await component.onSubmit();

    expect(authSpy.signIn).toHaveBeenCalledWith('user@example.com', 'secret123');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('does not navigate when sign-in fails', async () => {
    authSpy.signIn.mockResolvedValue({ success: false, error: 'Invalid credentials' });
    component.email = 'user@example.com';
    component.password = 'wrong';

    await component.onSubmit();

    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('resets the loading flag even when sign-in fails', async () => {
    authSpy.signIn.mockResolvedValue({ success: false, error: 'Invalid credentials' });
    component.email = 'user@example.com';
    component.password = 'wrong';

    await component.onSubmit();

    expect(component.loading()).toBe(false);
  });

  it('toggles password visibility', () => {
    expect(component.hidePassword()).toBe(true);
    component.togglePasswordVisibility();
    expect(component.hidePassword()).toBe(false);
  });

  it('delegates Google sign-in to AuthService', async () => {
    await component.signInWithGoogle();
    expect(authSpy.signInWithOAuth).toHaveBeenCalledWith('google');
  });

  it('delegates GitHub sign-in to AuthService', async () => {
    await component.signInWithGitHub();
    expect(authSpy.signInWithOAuth).toHaveBeenCalledWith('github');
  });
});
