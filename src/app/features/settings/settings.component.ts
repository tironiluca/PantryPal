import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  standalone: true,
  selector: 'pp-settings',
  imports: [CommonModule, MatCardModule, MatSlideToggleModule],
  template: `
  <mat-card>
    <mat-slide-toggle [checked]="theme.mode()==='dark'" (change)="theme.set($event.checked ? 'dark' : 'light')">Dark theme</mat-slide-toggle>
  </mat-card>
  `
})
export class SettingsComponent {
  theme = inject(ThemeService);
}
