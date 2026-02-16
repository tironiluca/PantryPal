import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DbService } from './db.service';
import { ProductsService } from './products.service';
import { AuthService } from './auth.service';

export interface NutritionData {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
}

export interface NutritionGoals {
  userId: string;
  dailyKcalGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  fiberGoal?: number;
  sugarGoal?: number;
  sodiumGoal?: number;
}

export interface NutritionLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  recipeId?: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber?: number;
  totalSugar?: number;
  totalSodium?: number;
  notes?: string;
  createdAt: string;
}

export interface DailyNutritionSummary {
  date: string;
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalSugar: number;
  totalSodium: number;
  goals?: NutritionGoals;
  percentKcal?: number;
  percentProtein?: number;
  percentCarbs?: number;
  percentFat?: number;
}

@Injectable({
  providedIn: 'root',
})
export class NutritionService {
  private db = inject(DbService);
  private products = inject(ProductsService);
  private auth = inject(AuthService);

  /**
   * Get or fetch nutrition data for an ingredient by barcode
   */
  async getNutritionByBarcode(barcode: string): Promise<NutritionData | null> {
    try {
      const response = await firstValueFrom(this.products.byBarcode(barcode));
      if (!response || response.status !== 1 || !response.product || !response.product.nutriments) {
        return null;
      }

      return this.extractNutritionFromProduct(response.product);
    } catch (error) {
      console.error('Failed to fetch nutrition data:', error);
      return null;
    }
  }

  /**
   * Get or fetch nutrition data for an ingredient by name
   * TODO: Implement when ProductsService adds search by name functionality
   */
  async getNutritionByName(name: string): Promise<NutritionData | null> {
    console.warn('Search by name not yet implemented in ProductsService');
    return null;
  }

  /**
   * Extract nutrition data from Open Food Facts product
   */
  private extractNutritionFromProduct(product: any): NutritionData {
    const nutriments = product.nutriments || {};

    return {
      energyKcal: nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0,
      proteinG: nutriments.proteins_100g || nutriments.proteins || 0,
      carbsG: nutriments.carbohydrates_100g || nutriments.carbohydrates || 0,
      fatG: nutriments.fat_100g || nutriments.fat || 0,
      fiberG: nutriments.fiber_100g || nutriments.fiber,
      sugarG: nutriments.sugars_100g || nutriments.sugars,
      sodiumMg: (nutriments.sodium_100g || nutriments.sodium || 0) * 1000, // Convert g to mg
    };
  }

  /**
   * Update nutrition data for an ingredient
   */
  updateIngredientNutrition(ingredientId: string, nutrition: NutritionData): void {
    const now = new Date().toISOString();
    this.db.exec(
      `UPDATE ingredients
       SET nutritionData = ?, energyKcal = ?, proteinG = ?, carbsG = ?, fatG = ?,
           fiberG = ?, sugarG = ?, sodiumMg = ?, updatedAt = ?, version = version + 1
       WHERE id = ?`,
      [
        JSON.stringify(nutrition),
        nutrition.energyKcal,
        nutrition.proteinG,
        nutrition.carbsG,
        nutrition.fatG,
        nutrition.fiberG || null,
        nutrition.sugarG || null,
        nutrition.sodiumMg || null,
        now,
        ingredientId,
      ]
    );
  }

  /**
   * Get nutrition data for a recipe based on its ingredients
   */
  getRecipeNutrition(recipeId: string): NutritionData | null {
    const ingredients = this.db.query<any>(
      `SELECT ri.quantity, ri.unit, i.energyKcal, i.proteinG, i.carbsG, i.fatG, i.fiberG, i.sugarG, i.sodiumMg
       FROM recipe_ingredients ri
       JOIN ingredients i ON ri.ingredientId = i.id
       WHERE ri.recipeId = ? AND (ri.isDeleted IS NULL OR ri.isDeleted = 0)`,
      [recipeId]
    );

    if (ingredients.length === 0) {
      return null;
    }

    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalSugar = 0;
    let totalSodium = 0;

    for (const ing of ingredients) {
      // Nutrition data is typically per 100g, so scale by quantity
      // This is a simplification - ideally we'd have unit conversion
      const scaleFactor = ing.quantity / 100;

      totalKcal += (ing.energyKcal || 0) * scaleFactor;
      totalProtein += (ing.proteinG || 0) * scaleFactor;
      totalCarbs += (ing.carbsG || 0) * scaleFactor;
      totalFat += (ing.fatG || 0) * scaleFactor;
      totalFiber += (ing.fiberG || 0) * scaleFactor;
      totalSugar += (ing.sugarG || 0) * scaleFactor;
      totalSodium += (ing.sodiumMg || 0) * scaleFactor;
    }

    return {
      energyKcal: Math.round(totalKcal),
      proteinG: Math.round(totalProtein * 10) / 10,
      carbsG: Math.round(totalCarbs * 10) / 10,
      fatG: Math.round(totalFat * 10) / 10,
      fiberG: Math.round(totalFiber * 10) / 10,
      sugarG: Math.round(totalSugar * 10) / 10,
      sodiumMg: Math.round(totalSodium),
    };
  }

  /**
   * Log a meal for nutrition tracking
   */
  logMeal(
    date: string,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    recipeId: string,
    servings: number = 1,
    notes?: string
  ): string {
    const userId = this.auth.getCurrentUserId();
    if (!userId) {
      throw new Error('User must be authenticated to log meals');
    }

    const nutrition = this.getRecipeNutrition(recipeId);
    if (!nutrition) {
      throw new Error('Could not calculate nutrition for this recipe');
    }

    const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date().toISOString();

    this.db.exec(
      `INSERT INTO nutrition_logs (id, userId, date, recipeId, mealType, servings, totalKcal, totalProtein, totalCarbs, totalFat, totalFiber, totalSugar, totalSodium, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        date,
        recipeId,
        mealType,
        servings,
        nutrition.energyKcal * servings,
        nutrition.proteinG * servings,
        nutrition.carbsG * servings,
        nutrition.fatG * servings,
        (nutrition.fiberG || 0) * servings,
        (nutrition.sugarG || 0) * servings,
        (nutrition.sodiumMg || 0) * servings,
        notes || null,
        now,
      ]
    );

    return id;
  }

  /**
   * Get daily nutrition summary
   */
  getDailyNutrition(date: string): DailyNutritionSummary {
    const userId = this.auth.getCurrentUserId();
    if (!userId) {
      return this.getEmptySummary(date);
    }

    const logs = this.db.query<NutritionLog>(
      'SELECT * FROM nutrition_logs WHERE userId = ? AND date = ?',
      [userId, date]
    );

    const summary: DailyNutritionSummary = {
      date,
      totalKcal: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
      totalSugar: 0,
      totalSodium: 0,
    };

    for (const log of logs) {
      summary.totalKcal += log.totalKcal || 0;
      summary.totalProtein += log.totalProtein || 0;
      summary.totalCarbs += log.totalCarbs || 0;
      summary.totalFat += log.totalFat || 0;
      summary.totalFiber += log.totalFiber || 0;
      summary.totalSugar += log.totalSugar || 0;
      summary.totalSodium += log.totalSodium || 0;
    }

    // Get goals and calculate percentages
    const goals = this.getGoals();
    if (goals) {
      summary.goals = goals;
      summary.percentKcal = goals.dailyKcalGoal > 0 ? (summary.totalKcal / goals.dailyKcalGoal) * 100 : 0;
      summary.percentProtein = goals.proteinGoal > 0 ? (summary.totalProtein / goals.proteinGoal) * 100 : 0;
      summary.percentCarbs = goals.carbsGoal > 0 ? (summary.totalCarbs / goals.carbsGoal) * 100 : 0;
      summary.percentFat = goals.fatGoal > 0 ? (summary.totalFat / goals.fatGoal) * 100 : 0;
    }

    return summary;
  }

  /**
   * Get nutrition goals for current user
   */
  getGoals(): NutritionGoals | null {
    const userId = this.auth.getCurrentUserId();
    if (!userId) {
      return null;
    }

    const goals = this.db.query<NutritionGoals>(
      'SELECT * FROM nutrition_goals WHERE userId = ?',
      [userId]
    );

    return goals.length > 0 ? goals[0] : null;
  }

  /**
   * Set nutrition goals for current user
   */
  setGoals(goals: Omit<NutritionGoals, 'userId'>): void {
    const userId = this.auth.getCurrentUserId();
    if (!userId) {
      throw new Error('User must be authenticated to set goals');
    }

    const now = new Date().toISOString();

    // Check if goals exist
    const existing = this.getGoals();

    if (existing) {
      // Update
      this.db.exec(
        `UPDATE nutrition_goals
         SET dailyKcalGoal = ?, proteinGoal = ?, carbsGoal = ?, fatGoal = ?,
             fiberGoal = ?, sugarGoal = ?, sodiumGoal = ?, updatedAt = ?
         WHERE userId = ?`,
        [
          goals.dailyKcalGoal,
          goals.proteinGoal,
          goals.carbsGoal,
          goals.fatGoal,
          goals.fiberGoal || null,
          goals.sugarGoal || null,
          goals.sodiumGoal || null,
          now,
          userId,
        ]
      );
    } else {
      // Insert
      this.db.exec(
        `INSERT INTO nutrition_goals (userId, dailyKcalGoal, proteinGoal, carbsGoal, fatGoal, fiberGoal, sugarGoal, sodiumGoal, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          goals.dailyKcalGoal,
          goals.proteinGoal,
          goals.carbsGoal,
          goals.fatGoal,
          goals.fiberGoal || null,
          goals.sugarGoal || null,
          goals.sodiumGoal || null,
          now,
        ]
      );
    }
  }

  /**
   * Get nutrition logs for a date range
   */
  getLogsForRange(startDate: string, endDate: string): NutritionLog[] {
    const userId = this.auth.getCurrentUserId();
    if (!userId) {
      return [];
    }

    return this.db.query<NutritionLog>(
      'SELECT * FROM nutrition_logs WHERE userId = ? AND date >= ? AND date <= ? ORDER BY date DESC, createdAt DESC',
      [userId, startDate, endDate]
    );
  }

  /**
   * Delete a nutrition log
   */
  deleteLog(logId: string): void {
    this.db.exec('DELETE FROM nutrition_logs WHERE id = ?', [logId]);
  }

  /**
   * Get default recommended daily goals (based on average adult)
   */
  getDefaultGoals(): Omit<NutritionGoals, 'userId'> {
    return {
      dailyKcalGoal: 2000,
      proteinGoal: 50,
      carbsGoal: 275,
      fatGoal: 70,
      fiberGoal: 25,
      sugarGoal: 50,
      sodiumGoal: 2300,
    };
  }

  private getEmptySummary(date: string): DailyNutritionSummary {
    return {
      date,
      totalKcal: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
      totalSugar: 0,
      totalSodium: 0,
    };
  }
}
