import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DbService } from '../../core/services/db.service';
import { UnitConverterService, Unit } from '../../core/services/unit-converter.service';

interface ScoredRecipe {
  recipe: any;
  score: number;
  missing: string[];
  availableCount: number;
  totalCount: number;
}

@Component({
  standalone: true,
  selector: 'pp-meal-of-day',
  imports: [CommonModule, MatCardModule, MatChipsModule, MatIconModule, MatButtonModule],
  template: `
  <div class="meal-container">
    <mat-card *ngIf="recipe; else noRec" class="meal-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>restaurant</mat-icon>
          {{ recipe.name }}
        </mat-card-title>
        <mat-card-subtitle>
          <span class="score-badge">Score: {{ score }}/100</span>
          <span class="availability-badge" [class.all-available]="missing.length === 0">
            {{ availableCount }}/{{ totalCount }} ingredients available
          </span>
        </mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <div *ngIf="missing.length === 0" class="status success">
          <mat-icon>check_circle</mat-icon>
          <span>All ingredients available! Ready to cook.</span>
        </div>

        <div *ngIf="missing.length > 0" class="status warning">
          <mat-icon>warning</mat-icon>
          <span>Missing {{ missing.length }} ingredient(s)</span>
        </div>

        <div *ngIf="missing.length > 0" class="missing-ingredients">
          <h4>Missing Ingredients:</h4>
          <mat-chip-set>
            <mat-chip *ngFor="let ing of missing">{{ ing }}</mat-chip>
          </mat-chip-set>
        </div>

        <div *ngIf="expiringIngredients.length > 0" class="expiring-info">
          <mat-icon>schedule</mat-icon>
          <span>Uses {{ expiringIngredients.length }} ingredient(s) expiring soon</span>
        </div>
      </mat-card-content>

      <mat-card-actions>
        <button mat-raised-button color="primary" (click)="refreshSuggestion()">
          <mat-icon>refresh</mat-icon>
          Get Another Suggestion
        </button>
      </mat-card-actions>
    </mat-card>

    <ng-template #noRec>
      <mat-card class="empty-card">
        <mat-icon>no_meals</mat-icon>
        <h3>No recipes yet</h3>
        <p>Add some recipes to get personalized meal suggestions!</p>
      </mat-card>
    </ng-template>
  </div>
  `,
  styles: [`
    .meal-container {
      padding: 1.5rem;
      max-width: 680px;
      margin: 0 auto;
    }

    .meal-card {
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: white;
    }

    .meal-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
    }

    :host-context(.dark-theme) .meal-card {
      background: #1e1e1e;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }

    :host-context(.dark-theme) .meal-card:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    }

    .meal-card mat-card-header {
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #43a047 0%, #66bb6a 100%);
      padding: 1.5rem;
      color: white;
    }

    :host-context(.dark-theme) .meal-card mat-card-header {
      background: linear-gradient(135deg, #2e7d32 0%, #43a047 100%);
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 26px;
      font-weight: 700;
      color: white;
    }

    mat-card-title mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    mat-card-subtitle {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 0.75rem;
      color: rgba(255, 255, 255, 0.95);
    }

    .score-badge,
    .availability-badge {
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(8px);
      color: white;
    }

    .availability-badge.all-available {
      background: rgba(255, 255, 255, 0.35);
      color: white;
    }

    mat-card-content {
      padding: 1.5rem;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-radius: 12px;
      margin-bottom: 1.25rem;
      font-weight: 600;
      font-size: 15px;
    }

    .status mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .status.success {
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(102, 187, 106, 0.15));
      color: #2e7d32;
      border: 2px solid rgba(76, 175, 80, 0.3);
    }

    :host-context(.dark-theme) .status.success {
      background: linear-gradient(135deg, rgba(102, 187, 106, 0.2), rgba(129, 199, 132, 0.2));
      color: #81c784;
      border-color: rgba(102, 187, 106, 0.4);
    }

    .status.warning {
      background: linear-gradient(135deg, rgba(255, 152, 0, 0.15), rgba(251, 192, 45, 0.15));
      color: #f57c00;
      border: 2px solid rgba(255, 152, 0, 0.3);
    }

    :host-context(.dark-theme) .status.warning {
      background: linear-gradient(135deg, rgba(255, 152, 0, 0.2), rgba(251, 192, 45, 0.2));
      color: #ffb74d;
      border-color: rgba(255, 152, 0, 0.4);
    }

    .missing-ingredients {
      margin-top: 1.25rem;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 12px;
    }

    :host-context(.dark-theme) .missing-ingredients {
      background: rgba(255, 255, 255, 0.05);
    }

    .missing-ingredients h4 {
      margin: 0 0 0.75rem 0;
      font-size: 15px;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.87);
    }

    :host-context(.dark-theme) .missing-ingredients h4 {
      color: rgba(255, 255, 255, 0.87);
    }

    .expiring-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 1.25rem;
      padding: 1rem 1.25rem;
      background: linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(255, 152, 0, 0.15));
      border-radius: 12px;
      color: #f57c00;
      font-size: 14px;
      font-weight: 600;
      border: 2px solid rgba(255, 193, 7, 0.3);
    }

    :host-context(.dark-theme) .expiring-info {
      background: linear-gradient(135deg, rgba(255, 193, 7, 0.2), rgba(255, 152, 0, 0.2));
      color: #ffb74d;
      border-color: rgba(255, 193, 7, 0.4);
    }

    .expiring-info mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    mat-card-actions {
      padding: 0 1.5rem 1.5rem 1.5rem;
    }

    mat-card-actions button {
      width: 100%;
      height: 48px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 2px 8px rgba(67, 160, 71, 0.3);
      transition: all 0.3s ease;
    }

    mat-card-actions button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(67, 160, 71, 0.4);
    }

    :host-context(.dark-theme) mat-card-actions button {
      box-shadow: 0 2px 8px rgba(102, 187, 106, 0.3);
    }

    :host-context(.dark-theme) mat-card-actions button:hover {
      box-shadow: 0 4px 12px rgba(102, 187, 106, 0.4);
    }

    .empty-card {
      text-align: center;
      padding: 4rem 2rem;
      border-radius: 16px;
      background: white;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }

    :host-context(.dark-theme) .empty-card {
      background: #1e1e1e;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }

    .empty-card mat-icon {
      font-size: 120px;
      width: 120px;
      height: 120px;
      color: rgba(0, 0, 0, 0.2);
      margin-bottom: 1.5rem;
    }

    :host-context(.dark-theme) .empty-card mat-icon {
      color: rgba(255, 255, 255, 0.2);
    }

    .empty-card h3 {
      margin: 0 0 0.75rem 0;
      font-size: 24px;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.87);
    }

    :host-context(.dark-theme) .empty-card h3 {
      color: rgba(255, 255, 255, 0.87);
    }

    .empty-card p {
      color: rgba(0, 0, 0, 0.6);
      font-size: 16px;
      margin: 0;
    }

    :host-context(.dark-theme) .empty-card p {
      color: rgba(255, 255, 255, 0.6);
    }

    @media (max-width: 600px) {
      .meal-container {
        padding: 1rem;
      }

      mat-card-title {
        font-size: 22px;
      }

      mat-card-subtitle {
        flex-direction: column;
        gap: 0.5rem;
      }
    }
  `]
})
export class MealOfDayComponent {
  private db = inject(DbService);
  private unitConverter = inject(UnitConverterService);

  recipe: any = null;
  missing: string[] = [];
  score = 0;
  availableCount = 0;
  totalCount = 0;
  expiringIngredients: string[] = [];
  private excludedRecipeIds: Set<string> = new Set();

  constructor() {
    this.selectBestRecipe();
  }

  refreshSuggestion(): void {
    if (this.recipe) {
      this.excludedRecipeIds.add(this.recipe.id);
    }
    this.selectBestRecipe();
  }

  private selectBestRecipe(): void {
    const recipes = this.db.query<any>('SELECT * FROM recipes');
    if (recipes.length === 0) return;

    // Score all recipes
    const scoredRecipes = recipes
      .filter(r => !this.excludedRecipeIds.has(r.id))
      .map(recipe => this.scoreRecipe(recipe));

    // If all recipes have been excluded, reset and try again
    if (scoredRecipes.length === 0) {
      this.excludedRecipeIds.clear();
      this.selectBestRecipe();
      return;
    }

    // Sort by score (highest first)
    scoredRecipes.sort((a, b) => b.score - a.score);

    // Select best match
    const best = scoredRecipes[0];
    this.recipe = best.recipe;
    this.missing = best.missing;
    this.score = Math.round(best.score);
    this.availableCount = best.availableCount;
    this.totalCount = best.totalCount;

    // Track as suggested
    this.markAsSuggested(this.recipe.id);

    // Find expiring ingredients used in this recipe
    this.findExpiringIngredients(this.recipe.id);
  }

  private scoreRecipe(recipe: any): ScoredRecipe {
    let score = 0;
    const missing: string[] = [];
    const expiringUsed: string[] = [];
    let availableCount = 0;

    const ingredients = this.db.query<any>(
      'SELECT ingredientId, quantity, unit FROM recipe_ingredients WHERE recipeId = ?',
      [recipe.id]
    );

    const totalCount = ingredients.length;

    for (const ing of ingredients) {
      // Check inventory - get all items with their units
      const inventoryItems = this.db.query<any>(
        'SELECT quantity, unit, expiry FROM inventory WHERE ingredientId = ?',
        [ing.ingredientId]
      );

      // Convert all inventory quantities to the recipe's required unit and sum them
      const items = inventoryItems.map((item: any) => ({
        quantity: item.quantity,
        unit: item.unit as Unit
      }));

      const totalAvailable = this.unitConverter.sumQuantities(items, ing.unit as Unit) || 0;
      const soonestExpiry = inventoryItems
        .filter((item: any) => item.expiry)
        .map((item: any) => item.expiry)
        .sort()[0]; // Get earliest expiry date

      // Score based on availability (0-10 points per ingredient)
      if (totalAvailable >= ing.quantity) {
        score += 10;
        availableCount++;

        // Bonus for using ingredients expiring soon (0-5 points)
        if (soonestExpiry) {
          const daysUntilExpiry = this.getDaysUntil(soonestExpiry);
          if (daysUntilExpiry < 7 && daysUntilExpiry >= 0) {
            const bonus = Math.max(0, 5 - daysUntilExpiry);
            score += bonus;
            expiringUsed.push(ing.ingredientId);
          }
        }
      } else if (totalAvailable > 0) {
        // Partial availability
        score += 5 * (totalAvailable / ing.quantity);
      } else {
        // Not available
        missing.push(ing.ingredientId);
      }
    }

    // Penalty for recently suggested recipes
    const lastSuggested = localStorage.getItem(`recipe-suggested-${recipe.id}`);
    if (lastSuggested) {
      const daysSince = (Date.now() - Number(lastSuggested)) / 86400000;
      if (daysSince < 7) {
        score -= 10 * (7 - daysSince);
      }
    }

    // Normalize score to 0-100 range
    const maxScore = totalCount * 15; // 10 points + 5 bonus per ingredient
    score = maxScore > 0 ? (score / maxScore) * 100 : 0;

    return {
      recipe,
      score: Math.max(0, score),
      missing,
      availableCount,
      totalCount
    };
  }

  private getDaysUntil(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.floor((date.getTime() - now.getTime()) / 86400000);
  }

  private markAsSuggested(recipeId: string): void {
    localStorage.setItem(`recipe-suggested-${recipeId}`, String(Date.now()));
  }

  private findExpiringIngredients(recipeId: string): void {
    this.expiringIngredients = [];
    const ingredients = this.db.query<any>(
      'SELECT ingredientId FROM recipe_ingredients WHERE recipeId = ?',
      [recipeId]
    );

    for (const ing of ingredients) {
      const inventory = this.db.query<any>(
        'SELECT MIN(expiry) as soonest FROM inventory WHERE ingredientId = ? AND expiry IS NOT NULL',
        [ing.ingredientId]
      )[0];

      if (inventory?.soonest) {
        const daysUntilExpiry = this.getDaysUntil(inventory.soonest);
        if (daysUntilExpiry < 7 && daysUntilExpiry >= 0) {
          this.expiringIngredients.push(ing.ingredientId);
        }
      }
    }
  }
}
