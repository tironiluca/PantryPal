import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ThemeService } from './core/services/theme.service';
import { DbService } from './core/services/db.service';
import { NotificationsService } from './core/services/notifications.service';

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
export class AppComponent implements OnInit {
  private theme = inject(ThemeService);
  private db = inject(DbService);
  private notif = inject(NotificationsService);

  async ngOnInit() {
    await this.db.init();
    await this.notif.requestPermission();
    this.notif.checkAndNotify();
    setInterval(() => this.notif.checkAndNotify(), 60 * 60 * 1000);
  }

  toggleTheme() {
    this.theme.set(this.theme.mode() === 'light' ? 'dark' : 'light');
  }
}
