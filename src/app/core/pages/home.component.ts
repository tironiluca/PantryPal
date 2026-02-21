import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule } from '@jsverse/transloco';
import { SyncStatusComponent } from '../../shared/components/sync-status/sync-status.component';
import { VoiceControlOverlayComponent } from '../../features/voice/voice-control-overlay.component';
import { SyncService } from '../services/sync.service';
import { AuthService } from '../services/auth.service';
import { VoiceService } from '../services/voice.service';
import { SnackbarService } from '../services/snackbar.service';

type FeatureTab = {
  labelKey: string;
  descKey: string;
  route: string;
  icon: string;
};

@Component({
  selector: 'pp-home',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatTabsModule,
    MatTooltipModule,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    TranslocoModule,
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
    if (this.auth.isAuthenticated()) {
      this.syncService.startAutoSync(5);
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
      labelKey: 'home.inventory',
      route: 'inventory',
      icon: 'inventory_2',
      descKey: 'home.inventoryDesc',
    },
    {
      labelKey: 'home.ingredients',
      route: 'ingredients',
      icon: 'category',
      descKey: 'home.ingredientsDesc',
    },
    {
      labelKey: 'home.recipes',
      route: 'recipes',
      icon: 'restaurant_menu',
      descKey: 'home.recipesDesc',
    },
    {
      labelKey: 'home.mealPlan',
      route: 'meal-plan',
      icon: 'event',
      descKey: 'home.mealPlanDesc',
    },
    {
      labelKey: 'home.nutrition',
      route: 'nutrition',
      icon: 'restaurant',
      descKey: 'home.nutritionDesc',
    },
    {
      labelKey: 'home.cart',
      route: 'cart',
      icon: 'shopping_cart',
      descKey: 'home.cartDesc',
    },
  ];
}
