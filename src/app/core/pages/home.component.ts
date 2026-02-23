import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule } from '@jsverse/transloco';
import { SyncService } from '../services/sync.service';
import { AuthService } from '../services/auth.service';

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
    MatButtonModule,
    TranslocoModule,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  private syncService = inject(SyncService);
  private auth = inject(AuthService);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.syncService.startAutoSync(5);
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
    {
      labelKey: 'home.settings',
      route: 'settings',
      icon: 'settings',
      descKey: 'home.settingsDesc',
    },
  ];
}
