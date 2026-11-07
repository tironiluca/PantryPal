import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let authSpy: { resetPassword: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authSpy = { resetPassword: vi.fn().mockResolvedValue({ success: true }) };

    await TestBed.configureTestingModule({
      imports: [
        ForgotPasswordComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [provideRouter([]), { provide: AuthService, useValue: authSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('does nothing when the email field is empty', async () => {
    component.email = '';
    await component.onSubmit();
    expect(authSpy.resetPassword).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('sends the reset request and shows confirmation on success', async () => {
    component.email = 'user@example.com';
    await component.onSubmit();
    expect(authSpy.resetPassword).toHaveBeenCalledWith('user@example.com');
    expect(component.emailSent()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('does not mark the email as sent when the service reports failure', async () => {
    authSpy.resetPassword.mockResolvedValue({ success: false });
    component.email = 'user@example.com';
    await component.onSubmit();
    expect(component.emailSent()).toBe(false);
  });

  it('clears the loading state even when the request throws', async () => {
    authSpy.resetPassword.mockRejectedValue(new Error('network error'));
    component.email = 'user@example.com';
    await expect(component.onSubmit()).rejects.toThrow('network error');
    expect(component.loading()).toBe(false);
  });

  it('sets the loading state while the request is in flight', async () => {
    let resolveFn: (value: { success: boolean }) => void = () => {};
    authSpy.resetPassword.mockReturnValue(new Promise((resolve) => { resolveFn = resolve; }));
    component.email = 'user@example.com';
    const pending = component.onSubmit();
    expect(component.loading()).toBe(true);
    resolveFn({ success: true });
    await pending;
    expect(component.loading()).toBe(false);
  });
});
