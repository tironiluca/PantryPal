import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'pp-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  displayName = '';
  email = '';
  password = '';
  confirmPassword = '';
  acceptTerms = false;
  loading = signal(false);
  hidePassword = signal(true);
  hideConfirmPassword = signal(true);

  passwordsMatch(): boolean {
    return this.password === this.confirmPassword || this.confirmPassword === '';
  }

  isPasswordStrong(): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return strongRegex.test(this.password);
  }

  
  isFormValid(): boolean {
    return !!(
      this.email &&
      this.password &&
      this.confirmPassword &&
      this.acceptTerms &&
      this.passwordsMatch() &&
      this.password.length >= 6
    );
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid()) {
      return;
    }

    this.loading.set(true);

    try {
      const result = await this.auth.signUp(this.email, this.password, this.displayName || undefined);

      if (result.success) {
        // Redirect to login with success message
        await this.router.navigate(['/auth/login']);
      }
    } finally {
      this.loading.set(false);
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword.set(!this.hidePassword());
  }

  toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword.set(!this.hideConfirmPassword());
  }
}
