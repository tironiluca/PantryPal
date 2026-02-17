import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { DomSanitizer } from '@angular/platform-browser';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';
import { MigrationService } from './core/services/migration.service';

@Component({
  selector: 'pp-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule],
  template: `
  <mat-toolbar class="app-toolbar" color="primary">
    <div class="toolbar-content">
      <div class="brand">
        <mat-icon class="brand-icon">kitchen</mat-icon>
        <span class="brand-name">PantryPal</span>
      </div>
      <div class="toolbar-actions">
        <button mat-icon-button (click)="toggleTheme()" class="theme-toggle" aria-label="Toggle theme">
          <mat-icon>{{ theme.mode() === 'light' ? 'dark_mode' : 'light_mode' }}</mat-icon>
        </button>
        @if (auth.isAuthenticated()) {
          <button mat-icon-button [matMenuTriggerFor]="userMenu" class="user-menu-button" aria-label="User menu">
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item routerLink="/auth/profile">
              <mat-icon>person</mat-icon>
              <span>Profile</span>
            </button>
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Logout</span>
            </button>
          </mat-menu>
        } @else {
          <button mat-icon-button routerLink="/auth/login" class="login-button" aria-label="Login">
            <mat-icon>login</mat-icon>
          </button>
        }
      </div>
    </div>
  </mat-toolbar>
  <router-outlet></router-outlet>
  `,
  styles: [`
    .app-toolbar {
      background: linear-gradient(135deg, #c4521f 0%, #e64a19 100%) !important;
      box-shadow: 0 2px 8px rgba(120, 50, 10, 0.25);
      height: 64px;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    :host-context(.dark-theme) .app-toolbar {
      background: linear-gradient(135deg, #2d1105 0%, #4a1e0a 100%) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      border-bottom: 1px solid rgba(255, 150, 100, 0.12);
    }

    .toolbar-content {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: transform 0.2s ease;

      &:hover {
        transform: scale(1.02);
      }
    }

    .brand-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      animation: pulse 2s ease-in-out infinite;
    }

    .brand-name {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .theme-toggle {
      transition: transform 0.3s ease, background-color 0.3s ease;

      &:hover {
        transform: rotate(180deg);
        background-color: rgba(255, 255, 255, 0.1);
      }
    }

    .user-menu-button,
    .login-button {
      transition: background-color 0.3s ease;

      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }
  `]
})
export class AppComponent {
  theme = inject(ThemeService);
  auth = inject(AuthService);
  private migration = inject(MigrationService);

  constructor() {
    const iconRegistry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    iconRegistry.addSvgIconLiteral('google', sanitizer.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`
    ));

    // React to authentication state changes
    effect(() => {
      const isAuthenticated = this.auth.isAuthenticated();

      if (isAuthenticated && !this.auth.loading()) {
        // User just signed in, check and migrate data
        this.migration.checkAndMigrate();
      }
    });
  }

  toggleTheme() {
    this.theme.set(this.theme.mode() === 'light' ? 'dark' : 'light');
  }

  async logout() {
    await this.auth.signOut();
  }
}

