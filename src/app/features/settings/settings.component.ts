import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from '../../core/services/theme.service';
import { LanguageService } from '../../core/services/language.service';
import { TranslocoModule } from '@jsverse/transloco';
import { HouseholdSettingsComponent } from './household-settings.component';

@Component({
  standalone: true,
  selector: 'pp-settings',
  imports: [
    MatCardModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    TranslocoModule,
    HouseholdSettingsComponent,
  ],
  template: `
    <div class="settings-container" *transloco="let t">
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>language</mat-icon>
            {{ t('settings.language') }}
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field appearance="outline" class="lang-select">
            <mat-label>{{ t('settings.language') }}</mat-label>
            <mat-select [value]="lang.currentLang()" (selectionChange)="lang.setLanguage($event.value)">
              @for (l of lang.availableLanguages; track l.code) {
                <mat-option [value]="l.code">{{ l.label }}</mat-option>
              }
            </mat-select>
            <mat-icon matPrefix>language</mat-icon>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>palette</mat-icon>
            {{ t('settings.darkTheme') }}
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-slide-toggle
            [checked]="theme.mode()==='dark'"
            (change)="theme.set($event.checked ? 'dark' : 'light')">
            {{ t('settings.darkTheme') }}
          </mat-slide-toggle>
        </mat-card-content>
      </mat-card>

      <pp-household-settings></pp-household-settings>
    </div>
  `,
  styles: [`
    .settings-container {
      max-width: 600px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }
    mat-card-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
    mat-card-content {
      padding: var(--spacing-md);
    }
    .lang-select {
      width: 100%;
    }
  `]
})
export class SettingsComponent {
  theme = inject(ThemeService);
  lang = inject(LanguageService);
}
