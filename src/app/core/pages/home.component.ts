import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

type FeatureTab = {
  label: string;
  route: string;
  icon: string;
  description: string;
};

@Component({
  selector: 'pp-home',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, MatTabsModule, MatTooltipModule, MatIconModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
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
