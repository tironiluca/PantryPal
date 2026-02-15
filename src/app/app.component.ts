import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'pp-root',
  standalone: true,
  imports: [RouterOutlet, MatToolbarModule, MatIconModule, MatButtonModule],
  template: `
  <mat-toolbar class="app-toolbar" color="primary">
    <div class="toolbar-content">
      <div class="brand">
        <mat-icon class="brand-icon">kitchen</mat-icon>
        <span class="brand-name">PantryPal</span>
      </div>
      <button mat-icon-button (click)="toggleTheme()" class="theme-toggle" aria-label="Toggle theme">
        <mat-icon>{{ theme.mode() === 'light' ? 'dark_mode' : 'light_mode' }}</mat-icon>
      </button>
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

    .theme-toggle {
      transition: transform 0.3s ease, background-color 0.3s ease;

      &:hover {
        transform: rotate(180deg);
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

  toggleTheme() {
    this.theme.set(this.theme.mode() === 'light' ? 'dark' : 'light');
  }
}

