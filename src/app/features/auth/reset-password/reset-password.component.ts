import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

export const MIN_PASSWORD_LENGTH = 6;

/**
 * Landing page for the password-recovery email link.
 *
 * Supabase restores a short-lived recovery session from the link before this page renders,
 * so the page only needs to collect the new password and call `updatePassword()`.
 * Without that session the link is invalid or expired, and the user is sent back to request a new one.
 */
@Component({
  selector: 'pp-reset-password',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../forgot-password/forgot-password.component.scss'],
})
export class ResetPasswordComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly minLength = MIN_PASSWORD_LENGTH;

  password = '';
  confirmPassword = '';
  hidePassword = signal(true);
  saving = signal(false);

  /** True while Supabase is still restoring the session from the link. */
  checkingLink = this.auth.loading;
  /** The recovery link produced a session that may change the password. */
  hasRecoverySession = computed(() => !this.auth.loading() && this.auth.isAuthenticated());

  passwordsMatch(): boolean {
    return this.password === this.confirmPassword;
  }

  canSubmit(): boolean {
    return (
      this.password.length >= MIN_PASSWORD_LENGTH &&
      this.passwordsMatch() &&
      !this.saving() &&
      this.hasRecoverySession()
    );
  }

  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }

    this.saving.set(true);
    try {
      const result = await this.auth.updatePassword(this.password);
      if (result.success) {
        await this.router.navigate(['/home']);
      }
    } finally {
      this.saving.set(false);
    }
  }
}
