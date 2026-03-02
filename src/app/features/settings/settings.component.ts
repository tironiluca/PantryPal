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
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  theme = inject(ThemeService);
  lang = inject(LanguageService);
}
