import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { SyncStatusComponent } from '../../shared/components/sync-status/sync-status.component';
import { VoiceControlOverlayComponent } from '../../features/voice/voice-control-overlay.component';
import { SyncService } from '../services/sync.service';
import { AuthService } from '../services/auth.service';
import { VoiceService } from '../services/voice.service';
import { SnackbarService } from '../services/snackbar.service';

type FeatureTab = {
  label: string;
  route: string;
  icon: string;
  description: string;
};

@Component({
  selector: 'pp-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatTabsModule,
    MatTooltipModule,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    SyncStatusComponent,
    VoiceControlOverlayComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  private syncService = inject(SyncService);
  private auth = inject(AuthService);
  private voiceService = inject(VoiceService);
  private snackbar = inject(SnackbarService);

  voiceSupported = this.voiceService.isSupported();

  ngOnInit(): void {
    // Start auto-sync if user is authenticated
    if (this.auth.isAuthenticated()) {
      this.syncService.startAutoSync(5); // Sync every 5 minutes
    }
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
  readonly tabs: FeatureTab[] = [
    {
      label: 'Inventory',
      route: 'inventory',
      icon: 'inventory_2',
      description: 'Track pantry items and expirations.',
    },
    {
      label: 'Ingredients',
      route: 'ingredients',
      icon: 'category',
      description: 'Manage ingredients and metadata.',
    },
    {
      label: 'Recipes',
      route: 'recipes',
      icon: 'restaurant_menu',
      description: 'Discover meals and plan cooking.',
    },
    {
      label: 'Meal Plan',
      route: 'meal-plan',
      icon: 'event',
      description: 'Plan meals on a calendar and generate shopping lists.',
    },
    {
      label: 'Nutrition',
      route: 'nutrition',
      icon: 'restaurant',
      description: 'Track daily nutrition and macronutrient goals.',
    },
    {
      label: 'Cart',
      route: 'cart',
      icon: 'shopping_cart',
      description: 'Build shopping lists from shortages.',
    },
    {
      label: 'Settings',
      route: 'settings',
      icon: 'tune',
      description: 'Configure notifications and defaults.',
    },
  ];
}
