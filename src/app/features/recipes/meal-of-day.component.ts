import { Component, inject } from '@angular/core';

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
  imports: [MatCardModule, MatChipsModule, MatIconModule, MatButtonModule],
  templateUrl: './meal-of-day.component.html',
  styleUrls: ['./meal-of-day.component.scss'],
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
      const ingredient = this.db.query<{ name: string }>(
        'SELECT name FROM ingredients WHERE id = ?',
        [ing.ingredientId]
      )[0];

      // Check inventory - get all items with their units
      const inventoryItems = this.db.query<any>(
        'SELECT quantity, unit, expiry FROM inventory WHERE ingredientId = ?',
        [ing.ingredientId]
      );

      // Convert all inventory quantities to the recipe's required unit and sum them
      const items = inventoryItems.map((item: any) => ({
        quantity: item.quantity,
        unit: item.unit as Unit,
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
        // Not available; keep the ID as a fallback for incomplete legacy data.
        missing.push(ingredient?.name || ing.ingredientId);
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
      totalCount,
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
