import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/services/auth.service';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let authSpy: { signUp: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authSpy = { signUp: vi.fn().mockResolvedValue({ success: true }) };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [
        RegisterComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fillValidForm() {
    component.email = 'user@example.com';
    component.password = 'Password1';
    component.confirmPassword = 'Password1';
    component.acceptTerms = true;
  }

  describe('passwordsMatch', () => {
    it('is true when confirmation is empty', () => {
      component.password = 'Password1';
      component.confirmPassword = '';
      expect(component.passwordsMatch()).toBe(true);
    });

    it('is true when both fields match', () => {
      component.password = 'Password1';
      component.confirmPassword = 'Password1';
      expect(component.passwordsMatch()).toBe(true);
    });

    it('is false when they differ', () => {
      component.password = 'Password1';
      component.confirmPassword = 'Different1';
      expect(component.passwordsMatch()).toBe(false);
    });
  });

  describe('isPasswordStrong', () => {
    it('requires upper, lower, digit, and 8+ characters', () => {
      component.password = 'Password1';
      expect(component.isPasswordStrong()).toBe(true);
    });

    it('rejects a password missing a digit', () => {
      component.password = 'Passwordx';
      expect(component.isPasswordStrong()).toBe(false);
    });

    it('rejects a password shorter than 8 characters', () => {
      component.password = 'Pass1';
      expect(component.isPasswordStrong()).toBe(false);
    });
  });

  describe('isFormValid', () => {
    it('is false until every requirement is met', () => {
      expect(component.isFormValid()).toBe(false);
      fillValidForm();
      expect(component.isFormValid()).toBe(true);
    });

    it('is false when terms are not accepted', () => {
      fillValidForm();
      component.acceptTerms = false;
      expect(component.isFormValid()).toBe(false);
    });

    it('is false when passwords do not match', () => {
      fillValidForm();
      component.confirmPassword = 'Mismatch1';
      expect(component.isFormValid()).toBe(false);
    });

    it('is false when the password is shorter than 6 characters', () => {
      fillValidForm();
      component.password = 'Pw1';
      component.confirmPassword = 'Pw1';
      expect(component.isFormValid()).toBe(false);
    });
  });

  describe('onSubmit', () => {
    it('does nothing when the form is invalid', async () => {
      await component.onSubmit();
      expect(authSpy.signUp).not.toHaveBeenCalled();
    });

    it('signs up and navigates to login on success', async () => {
      fillValidForm();
      component.displayName = 'Jamie';
      await component.onSubmit();

      expect(authSpy.signUp).toHaveBeenCalledWith('user@example.com', 'Password1', 'Jamie');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
      expect(component.loading()).toBe(false);
    });

    it('passes undefined for a blank display name', async () => {
      fillValidForm();
      component.displayName = '';
      await component.onSubmit();
      expect(authSpy.signUp).toHaveBeenCalledWith('user@example.com', 'Password1', undefined);
    });

    it('does not navigate when sign-up fails', async () => {
      authSpy.signUp.mockResolvedValue({ success: false });
      fillValidForm();
      await component.onSubmit();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('clears the loading state even if sign-up throws', async () => {
      authSpy.signUp.mockRejectedValue(new Error('network error'));
      fillValidForm();
      await expect(component.onSubmit()).rejects.toThrow('network error');
      expect(component.loading()).toBe(false);
    });
  });

  describe('visibility toggles', () => {
    it('toggles password visibility', () => {
      expect(component.hidePassword()).toBe(true);
      component.togglePasswordVisibility();
      expect(component.hidePassword()).toBe(false);
    });

    it('toggles confirm password visibility', () => {
      expect(component.hideConfirmPassword()).toBe(true);
      component.toggleConfirmPasswordVisibility();
      expect(component.hideConfirmPassword()).toBe(false);
    });
  });
});
