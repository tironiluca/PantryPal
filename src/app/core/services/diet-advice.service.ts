import { Injectable, inject } from '@angular/core';
import { DbService } from './db.service';
import { AuthService } from './auth.service';
import { NutritionService, NutritionGoals, DailyNutritionSummary } from './nutrition.service';

export interface RecipeSuggestion {
  recipeId: string;
  recipeName: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fitScore: number;       // 0-100
  pantryPercent: number;  // % of ingredients available
}

export interface DietAdvice {
  remainingKcal: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  suggestedRecipes: RecipeSuggestion[];
  insights: string[];
  mealTypeRecommendation: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

@Injectable({ providedIn: 'root' })
export class DietAdviceService {
  private db = inject(DbService);
  private auth = inject(AuthService);
  private nutritionService = inject(NutritionService);

  generateAdvice(summary: DailyNutritionSummary, goals: NutritionGoals): DietAdvice {
    const remainingKcal = Math.max(0, goals.dailyKcalGoal - summary.totalKcal);
    const remainingProtein = Math.max(0, goals.proteinGoal - summary.totalProtein);
    const remainingCarbs = Math.max(0, goals.carbsGoal - summary.totalCarbs);
    const remainingFat = Math.max(0, goals.fatGoal - summary.totalFat);

    const suggestedRecipes = this.suggestRecipes(remainingKcal, remainingProtein, remainingCarbs, remainingFat);
    const insights = this.buildInsights(summary, goals, remainingKcal, remainingProtein, remainingCarbs, remainingFat);
    const mealTypeRecommendation = this.recommendMealType();

    return {
      remainingKcal,
      remainingProtein,
      remainingCarbs,
      remainingFat,
      suggestedRecipes,
      insights,
      mealTypeRecommendation,
    };
  }

  private suggestRecipes(
    remainingKcal: number,
    remainingProtein: number,
    remainingCarbs: number,
    remainingFat: number
  ): RecipeSuggestion[] {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return [];

    // Get all recipes
    const recipes = this.db.query<any>(
      `SELECT id, name FROM recipes WHERE (isDeleted IS NULL OR isDeleted = 0) AND (userId = ? OR userId IS NULL)`,
      [userId]
    );

    const scored: RecipeSuggestion[] = [];

    for (const recipe of recipes) {
      const nutrition = this.nutritionService.getRecipeNutrition(recipe.id);
      if (!nutrition || nutrition.energyKcal === 0) continue;

      // Score: how well does this recipe fill remaining without overshoot
      const kcalScore = this.scoreFit(nutrition.energyKcal, remainingKcal);
      const proteinScore = this.scoreFit(nutrition.proteinG, remainingProtein);
      const carbsScore = this.scoreFit(nutrition.carbsG, remainingCarbs);
      const fatScore = this.scoreFit(nutrition.fatG, remainingFat);

      const fitScore = Math.round((kcalScore * 0.4 + proteinScore * 0.3 + carbsScore * 0.2 + fatScore * 0.1) * 100);

      // Check ingredient availability
      const pantryPercent = this.getIngredientAvailability(recipe.id, userId);

      scored.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        energyKcal: nutrition.energyKcal,
        proteinG: nutrition.proteinG,
        carbsG: nutrition.carbsG,
        fatG: nutrition.fatG,
        fitScore,
        pantryPercent,
      });
    }

    return scored
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 5);
  }

  /**
   * Score how well `value` fits `remaining`. 1.0 = perfect fill, 0.0 = massive overshoot or irrelevant.
   */
  private scoreFit(value: number, remaining: number): number {
    if (remaining <= 0) return 0.5; // Goal already met, any addition is neutral
    const ratio = value / remaining;
    if (ratio <= 0) return 0;
    if (ratio <= 1) return ratio; // Partial fill: proportional score
    return Math.max(0, 1 - (ratio - 1)); // Overshoot penalty
  }

  private getIngredientAvailability(recipeId: string, userId: string): number {
    const recipeIngredients = this.db.query<any>(
      `SELECT ri.ingredientId FROM recipe_ingredients ri WHERE ri.recipeId = ? AND (ri.isDeleted IS NULL OR ri.isDeleted = 0)`,
      [recipeId]
    );

    if (recipeIngredients.length === 0) return 100;

    let inStock = 0;
    for (const ri of recipeIngredients) {
      const inv = this.db.query<any>(
        `SELECT id FROM inventory WHERE ingredientId = ? AND (isDeleted IS NULL OR isDeleted = 0) AND quantity > 0 LIMIT 1`,
        [ri.ingredientId]
      );
      if (inv.length > 0) inStock++;
    }

    return Math.round((inStock / recipeIngredients.length) * 100);
  }

  private buildInsights(
    summary: DailyNutritionSummary,
    goals: NutritionGoals,
    remainingKcal: number,
    remainingProtein: number,
    remainingCarbs: number,
    remainingFat: number
  ): string[] {
    const insights: string[] = [];

    const kcalPct = goals.dailyKcalGoal > 0 ? (summary.totalKcal / goals.dailyKcalGoal) * 100 : 0;
    const proteinPct = goals.proteinGoal > 0 ? (summary.totalProtein / goals.proteinGoal) * 100 : 0;
    const carbsPct = goals.carbsGoal > 0 ? (summary.totalCarbs / goals.carbsGoal) * 100 : 0;

    if (kcalPct > 110) {
      insights.push(`You've exceeded your calorie goal by ${Math.round(summary.totalKcal - goals.dailyKcalGoal)} kcal.`);
    } else if (kcalPct < 50 && new Date().getHours() > 14) {
      insights.push(`You still have ${Math.round(remainingKcal)} kcal remaining for today.`);
    } else if (kcalPct >= 90 && kcalPct <= 110) {
      insights.push(`You're right on track with your calorie goal!`);
    }

    if (proteinPct < 60) {
      insights.push(`You're ${Math.round(remainingProtein)}g short on protein. Consider adding eggs, chicken, or legumes.`);
    } else if (proteinPct >= 100) {
      insights.push(`Great job hitting your protein goal!`);
    }

    if (carbsPct > 130) {
      insights.push(`Your carb intake is high today — try lower-carb options for your next meal.`);
    }

    if (goals.trackFiber && summary.totalFiber < (goals.fiberGoal || 25) * 0.5) {
      insights.push(`Fiber intake is low. Add vegetables, fruits, or whole grains.`);
    }

    if (insights.length === 0) {
      insights.push(`Keep up the good work! Your nutrition is well balanced today.`);
    }

    return insights;
  }

  private recommendMealType(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
    const hour = new Date().getHours();
    if (hour < 10) return 'breakfast';
    if (hour < 14) return 'lunch';
    if (hour < 20) return 'dinner';
    return 'snack';
  }
}
