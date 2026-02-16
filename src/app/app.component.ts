import { Component, inject, OnInit, effect } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';
import { MigrationService } from './core/services/migration.service';
import { DbService } from './core/services/db.service';

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
      background: linear-gradient(135deg, #43a047 0%, #66bb6a 100%) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      height: 64px;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    :host-context(.dark-theme) .app-toolbar {
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
export class AppComponent implements OnInit {
  theme = inject(ThemeService);
  auth = inject(AuthService);
  private db = inject(DbService);
  private migration = inject(MigrationService);

  constructor() {
    // React to authentication state changes
    effect(() => {
      const isAuthenticated = this.auth.isAuthenticated();

      if (isAuthenticated && !this.auth.loading()) {
        // User just signed in, check and migrate data
        this.migration.checkAndMigrate();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    // Initialize database
    await this.db.init();

    // Check and migrate if user is already authenticated
    if (this.auth.isAuthenticated()) {
      await this.migration.checkAndMigrate();
    }
  }

  toggleTheme() {
    this.theme.set(this.theme.mode() === 'light' ? 'dark' : 'light');
  }

  async logout() {
    await this.auth.signOut();
  }
}

