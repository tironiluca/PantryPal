import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';
import { MigrationService } from './core/services/migration.service';
import { VoiceService } from './core/services/voice.service';
import { SnackbarService } from './core/services/snackbar.service';
import { SyncStatusComponent } from './shared/components/sync-status/sync-status.component';
import { VoiceControlOverlayComponent } from './features/voice/voice-control-overlay.component';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'pp-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    SyncStatusComponent,
    VoiceControlOverlayComponent,
    TranslocoModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  theme = inject(ThemeService);
  auth = inject(AuthService);
  private migration = inject(MigrationService);
  private voiceService = inject(VoiceService);
  private snackbar = inject(SnackbarService);

  voiceSupported = this.voiceService.isSupported();

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

  toggleVoiceControl(): void {
    if (!this.voiceSupported) {
      this.snackbar.warning('Voice commands are not supported in this browser');
      return;
    }

    try {
      this.voiceService.toggleListening();
    } catch (error) {
      console.error('Failed to toggle voice control:', error);
      this.snackbar.error('Failed to start voice control');
    }
  }

  async logout() {
    await this.auth.signOut();
  }
}
