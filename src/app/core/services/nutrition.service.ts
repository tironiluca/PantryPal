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
  trackFiber?: boolean;
  trackSugar?: boolean;
  trackSodium?: boolean;
  goalType?: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'custom';
}

export interface NutritionLog {
  id: string;
  userId: string;
  date: string;
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

export interface WeeklyNutritionReport {
  startDate: string;
  endDate: string;
  dailySummaries: DailyNutritionSummary[];
  avgKcal: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  daysTracked: number;
  goalAdherencePercent: number;
}

@Injectable({
  providedIn: 'root',
})
export class NutritionService {
  private db = inject(DbService);
  private products = inject(ProductsService);
  private auth = inject(AuthService);

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

  async getNutritionByName(name: string): Promise<NutritionData[] | null> {
    try {
      const response = await firstValueFrom(this.products.searchByName(name));
      if (!response?.products?.length) return null;

      return response.products
        .filter((p: any) => p.nutriments)
        .map((p: any) => ({
          ...this.extractNutritionFromProduct(p),
          productName: p.product_name || p.generic_name || name,
        }));
    } catch (error) {
      console.error('Failed to search nutrition data:', error);
      return null;
    }
  }

  private extractNutritionFromProduct(product: any): NutritionData {
    const nutriments = product.nutriments || {};
    return {
      energyKcal: nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0,
      proteinG: nutriments.proteins_100g || nutriments.proteins || 0,
      carbsG: nutriments.carbohydrates_100g || nutriments.carbohydrates || 0,
      fatG: nutriments.fat_100g || nutriments.fat || 0,
      fiberG: nutriments.fiber_100g || nutriments.fiber,
      sugarG: nutriments.sugars_100g || nutriments.sugars,
      sodiumMg: (nutriments.sodium_100g || nutriments.sodium || 0) * 1000,
    };
  }

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
   * Convert an ingredient quantity to grams so per-100g nutrition data can be scaled correctly.
   * Returns null for units that cannot be meaningfully converted (e.g. 'pcs').
   * BUG-19: without this, all non-gram units produce wrong nutrition totals.
   */
  private toGrams(quantity: number, unit: string): number | null {
    const GRAMS_PER_UNIT: Record<string, number> = {
      g: 1, gram: 1, grams: 1,
      kg: 1000, kilogram: 1000,
      oz: 28.3495, ounce: 28.3495,
      lb: 453.592, lbs: 453.592, pound: 453.592,
      ml: 1, milliliter: 1,             // water density approximation
      l: 1000, liter: 1000,
      cup: 240, cups: 240,
      tbsp: 15, tablespoon: 15,
      tsp: 5, teaspoon: 5,
    };
    const factor = GRAMS_PER_UNIT[(unit ?? 'g').toLowerCase()];
    return factor != null ? quantity * factor : null;
  }

  getRecipeNutrition(recipeId: string): NutritionData | null {
    const ingredients = this.db.query<any>(
      `SELECT ri.quantity, ri.unit, i.energyKcal, i.proteinG, i.carbsG, i.fatG, i.fiberG, i.sugarG, i.sodiumMg
       FROM recipe_ingredients ri
       JOIN ingredients i ON ri.ingredientId = i.id
       WHERE ri.recipeId = ? AND (ri.isDeleted IS NULL OR ri.isDeleted = 0)`,
      [recipeId]
    );

    if (ingredients.length === 0) return null;

    let totalKcal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    let totalFiber = 0, totalSugar = 0, totalSodium = 0;

    for (const ing of ingredients) {
      const grams = this.toGrams(ing.quantity, ing.unit);
      if (grams === null) continue; // unit not convertible (e.g. 'pcs') — skip
      const scaleFactor = grams / 100;
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

  logMeal(
    date: string,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    recipeId: string,
    servings: number = 1,
    notes?: string
  ): string {
    const userId = this.auth.getCurrentUserId();
    if (!userId) throw new Error('User must be authenticated to log meals');

    const nutrition = this.getRecipeNutrition(recipeId);
    if (!nutrition) throw new Error('Could not calculate nutrition for this recipe');

    const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date().toISOString();

    this.db.exec(
      `INSERT INTO nutrition_logs (id, userId, date, recipeId, mealType, servings, totalKcal, totalProtein, totalCarbs, totalFat, totalFiber, totalSugar, totalSodium, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, userId, date, recipeId, mealType, servings,
        nutrition.energyKcal * servings,
        nutrition.proteinG * servings,
        nutrition.carbsG * servings,
        nutrition.fatG * servings,
        (nutrition.fiberG || 0) * servings,
        (nutrition.sugarG || 0) * servings,
        (nutrition.sodiumMg || 0) * servings,
        notes || null, now,
      ]
    );

    return id;
  }

  getDailyNutrition(date: string): DailyNutritionSummary {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return this.getEmptySummary(date);

    const logs = this.db.query<NutritionLog>(
      'SELECT * FROM nutrition_logs WHERE userId = ? AND date = ?',
      [userId, date]
    );

    const summary: DailyNutritionSummary = {
      date,
      totalKcal: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0,
      totalFiber: 0, totalSugar: 0, totalSodium: 0,
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

  getWeeklySummary(startDate: string): WeeklyNutritionReport {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endDate = this.formatDate(end);

    const dailySummaries: DailyNutritionSummary[] = [];
    const current = new Date(start);

    for (let i = 0; i < 7; i++) {
      dailySummaries.push(this.getDailyNutrition(this.formatDate(current)));
      current.setDate(current.getDate() + 1);
    }

    const tracked = dailySummaries.filter(d => d.totalKcal > 0);
    const daysTracked = tracked.length;

    const avgKcal = daysTracked > 0 ? tracked.reduce((s, d) => s + d.totalKcal, 0) / daysTracked : 0;
    const avgProtein = daysTracked > 0 ? tracked.reduce((s, d) => s + d.totalProtein, 0) / daysTracked : 0;
    const avgCarbs = daysTracked > 0 ? tracked.reduce((s, d) => s + d.totalCarbs, 0) / daysTracked : 0;
    const avgFat = daysTracked > 0 ? tracked.reduce((s, d) => s + d.totalFat, 0) / daysTracked : 0;

    const goals = this.getGoals();
    let goalAdherencePercent = 0;
    if (goals && daysTracked > 0) {
      const metGoalDays = tracked.filter(d => {
        const kcalOk = !goals.dailyKcalGoal || (d.totalKcal >= goals.dailyKcalGoal * 0.8 && d.totalKcal <= goals.dailyKcalGoal * 1.2);
        return kcalOk;
      }).length;
      goalAdherencePercent = Math.round((metGoalDays / daysTracked) * 100);
    }

    return {
      startDate,
      endDate,
      dailySummaries,
      avgKcal: Math.round(avgKcal),
      avgProtein: Math.round(avgProtein * 10) / 10,
      avgCarbs: Math.round(avgCarbs * 10) / 10,
      avgFat: Math.round(avgFat * 10) / 10,
      daysTracked,
      goalAdherencePercent,
    };
  }

  getGoals(): NutritionGoals | null {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return null;

    const goals = this.db.query<any>(
      'SELECT * FROM nutrition_goals WHERE userId = ?',
      [userId]
    );

    if (goals.length === 0) return null;

    const g = goals[0];
    return {
      ...g,
      trackFiber: !!g.trackFiber,
      trackSugar: !!g.trackSugar,
      trackSodium: !!g.trackSodium,
    };
  }

  setGoals(goals: Omit<NutritionGoals, 'userId'>): void {
    const userId = this.auth.getCurrentUserId();
    if (!userId) throw new Error('User must be authenticated to set goals');

    const now = new Date().toISOString();
    const existing = this.getGoals();

    if (existing) {
      this.db.exec(
        `UPDATE nutrition_goals
         SET dailyKcalGoal = ?, proteinGoal = ?, carbsGoal = ?, fatGoal = ?,
             fiberGoal = ?, sugarGoal = ?, sodiumGoal = ?,
             trackFiber = ?, trackSugar = ?, trackSodium = ?, goalType = ?,
             updatedAt = ?
         WHERE userId = ?`,
        [
          goals.dailyKcalGoal, goals.proteinGoal, goals.carbsGoal, goals.fatGoal,
          goals.fiberGoal || null, goals.sugarGoal || null, goals.sodiumGoal || null,
          goals.trackFiber ? 1 : 0, goals.trackSugar ? 1 : 0, goals.trackSodium ? 1 : 0,
          goals.goalType || 'custom', now, userId,
        ]
      );
    } else {
      this.db.exec(
        `INSERT INTO nutrition_goals (userId, dailyKcalGoal, proteinGoal, carbsGoal, fatGoal, fiberGoal, sugarGoal, sodiumGoal, trackFiber, trackSugar, trackSodium, goalType, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, goals.dailyKcalGoal, goals.proteinGoal, goals.carbsGoal, goals.fatGoal,
          goals.fiberGoal || null, goals.sugarGoal || null, goals.sodiumGoal || null,
          goals.trackFiber ? 1 : 0, goals.trackSugar ? 1 : 0, goals.trackSodium ? 1 : 0,
          goals.goalType || 'custom', now,
        ]
      );
    }
  }

  getLogsForRange(startDate: string, endDate: string): NutritionLog[] {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return [];
    return this.db.query<NutritionLog>(
      'SELECT * FROM nutrition_logs WHERE userId = ? AND date >= ? AND date <= ? ORDER BY date DESC, createdAt DESC',
      [userId, startDate, endDate]
    );
  }

  deleteLog(logId: string): void {
    // Include userId check to prevent deleting another user's log (BUG-13)
    const userId = this.db.getCurrentUserId();
    this.db.exec('DELETE FROM nutrition_logs WHERE id = ? AND userId = ?', [logId, userId]);
  }

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

  getPresetGoals(type: string): Omit<NutritionGoals, 'userId'> {
    switch (type) {
      case 'weight_loss':
        return { dailyKcalGoal: 1500, proteinGoal: 100, carbsGoal: 150, fatGoal: 50, fiberGoal: 30, sugarGoal: 30, sodiumGoal: 2000, goalType: 'weight_loss' };
      case 'muscle_gain':
        return { dailyKcalGoal: 2800, proteinGoal: 150, carbsGoal: 350, fatGoal: 80, fiberGoal: 30, sugarGoal: 60, sodiumGoal: 2500, goalType: 'muscle_gain' };
      case 'maintenance':
        return { dailyKcalGoal: 2000, proteinGoal: 75, carbsGoal: 250, fatGoal: 65, fiberGoal: 25, sugarGoal: 50, sodiumGoal: 2300, goalType: 'maintenance' };
      default:
        return this.getDefaultGoals();
    }
  }

  private getEmptySummary(date: string): DailyNutritionSummary {
    return {
      date,
      totalKcal: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0,
      totalFiber: 0, totalSugar: 0, totalSodium: 0,
    };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
