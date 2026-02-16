import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'pp-forgot-password',
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
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title>
            <div class="auth-header">
              <mat-icon class="auth-icon">lock_reset</mat-icon>
              <h1>Reset Password</h1>
            </div>
          </mat-card-title>
          <mat-card-subtitle>
            Enter your email address and we'll send you a link to reset your password
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          @if (!emailSent()) {
            <form (ngSubmit)="onSubmit()" #forgotForm="ngForm">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email</mat-label>
                <input
                  matInput
                  type="email"
                  name="email"
                  [(ngModel)]="email"
                  required
                  email
                  placeholder="your@email.com"
                  autocomplete="email"
                />
                <mat-icon matPrefix>email</mat-icon>
              </mat-form-field>

              <button
                mat-raised-button
                color="primary"
                type="submit"
                class="full-width auth-button"
                [disabled]="!forgotForm.form.valid || loading()"
              >
                @if (loading()) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  Send Reset Link
                }
              </button>
            </form>
          } @else {
            <div class="success-message">
              <mat-icon class="success-icon">check_circle</mat-icon>
              <p>
                Password reset email sent! Please check your inbox and follow the
                instructions to reset your password.
              </p>
            </div>
          }

          <div class="back-link">
            <a routerLink="/auth/login">
              <mat-icon>arrow_back</mat-icon>
              Back to Sign In
            </a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: var(--spacing-md);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .auth-card {
      width: 100%;
      max-width: 450px;
      padding: var(--spacing-lg);
    }

    .auth-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-md);

      .auth-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--primary-color);
      }

      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
        text-align: center;
      }
    }

    mat-card-header {
      mat-card-title {
        margin-bottom: var(--spacing-sm);
      }

      mat-card-subtitle {
        text-align: center;
        margin-bottom: var(--spacing-lg);
      }
    }

    mat-card-content {
      padding: 0;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .full-width {
      width: 100%;
    }

    .auth-button {
      height: 48px;
      font-size: 16px;
      margin-top: var(--spacing-sm);

      mat-spinner {
        margin: 0 auto;
      }
    }

    .success-message {
      text-align: center;
      padding: var(--spacing-lg) 0;

      .success-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #4caf50;
        margin-bottom: var(--spacing-md);
      }

      p {
        color: var(--text-secondary);
        line-height: 1.6;
      }
    }

    .back-link {
      text-align: center;
      margin-top: var(--spacing-lg);

      a {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
        color: var(--primary-color);
        text-decoration: none;
        font-size: 14px;

        &:hover {
          text-decoration: underline;
        }

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }

    @media (max-width: 600px) {
      .auth-container {
        padding: var(--spacing-sm);
      }

      .auth-card {
        padding: var(--spacing-md);
      }

      .auth-header h1 {
        font-size: 20px;
      }
    }
  `],
})
export class ForgotPasswordComponent {
  private auth = inject(AuthService);

  email = '';
  loading = signal(false);
  emailSent = signal(false);

  async onSubmit(): Promise<void> {
    if (!this.email) {
      return;
    }

    this.loading.set(true);

    try {
      const result = await this.auth.resetPassword(this.email);

      if (result.success) {
        this.emailSent.set(true);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
