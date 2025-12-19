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
  <mat-toolbar color="primary">
    <span>PantryPal</span>
    <span class="spacer"></span>
    <button mat-icon-button (click)="toggleTheme()" aria-label="Toggle theme"><mat-icon>brightness_6</mat-icon></button>
  </mat-toolbar>
  <router-outlet></router-outlet>
  `,
  styles: [`.spacer{flex:1 1 auto}`]
})
export class AppComponent {
  private theme = inject(ThemeService);

  toggleTheme() {
    this.theme.set(this.theme.mode() === 'light' ? 'dark' : 'light');
  }
}
