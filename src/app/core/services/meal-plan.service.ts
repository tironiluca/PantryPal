import { Injectable, inject } from '@angular/core';
import { DbService } from './db.service';
import { AuthService } from './auth.service';

export interface MealPlan {
  id: string;
  userId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipeId: string;
  servings: number;
  notes?: string;
  completed: boolean;
  // Sync metadata
  syncedAt?: string;
  version: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanWithRecipe extends MealPlan {
  recipeName?: string;
  recipeSteps?: string;
}

export interface ShoppingListItem {
  ingredientId: string;
  ingredientName: string;
  totalQuantity: number;
  unit: string;
  inventoryQuantity: number;
  needed: number;
  mealPlans: string[]; // Recipe names that need this ingredient
}

@Injectable({
  providedIn: 'root',
})
export class MealPlanService {
  private db = inject(DbService);
  private auth = inject(AuthService);

  /**
   * Get meal plan for a specific date
   */
  getPlanForDate(date: string): MealPlanWithRecipe[] {
    const plans = this.db.queryByUser<MealPlan>('meal_plans', 'date = ?', [date]);
    return this.enrichWithRecipeData(plans);
  }

  /**
   * Get meal plans for a date range
   */
  getPlanForDateRange(startDate: string, endDate: string): MealPlanWithRecipe[] {
    const plans = this.db.queryByUser<MealPlan>(
      'meal_plans',
      'date >= ? AND date <= ?',
      [startDate, endDate]
    );
    return this.enrichWithRecipeData(plans);
  }

  /**
   * Get meal plans for a specific week (7 days starting from the given date)
   */
  getPlanForWeek(startDate: Date): MealPlanWithRecipe[] {
    const start = this.formatDate(startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const end = this.formatDate(endDate);

    return this.getPlanForDateRange(start, end);
  }

  /**
   * Get meal plans for a specific month
   */
  getPlanForMonth(year: number, month: number): MealPlanWithRecipe[] {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of month

    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);

    return this.getPlanForDateRange(start, end);
  }

  /**
   * Add a meal to the plan
   */
  addMeal(
    date: string,
    mealType: MealPlan['mealType'],
    recipeId: string,
    servings: number = 1,
    notes?: string
  ): MealPlan {
    const userId = this.auth.getCurrentUserId();

    if (!userId) {
      throw new Error('User must be authenticated to add meal plans');
    }

    const now = new Date().toISOString();
    const id = `meal-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    const mealPlan: MealPlan = {
      id,
      userId,
      date,
      mealType,
      recipeId,
      servings,
      notes: notes || '',
      completed: false,
      version: 1,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    this.db.exec(
      `INSERT INTO meal_plans (id, userId, date, mealType, recipeId, servings, notes, completed, version, isDeleted, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mealPlan.id,
        mealPlan.userId,
        mealPlan.date,
        mealPlan.mealType,
        mealPlan.recipeId,
        mealPlan.servings,
        mealPlan.notes || null,
        mealPlan.completed ? 1 : 0,
        mealPlan.version,
        mealPlan.isDeleted ? 1 : 0,
        mealPlan.createdAt,
        mealPlan.updatedAt,
      ]
    );

    return mealPlan;
  }

  /**
   * Update a meal plan
   */
  updateMeal(
    id: string,
    updates: Partial<Pick<MealPlan, 'date' | 'mealType' | 'recipeId' | 'servings' | 'notes' | 'completed'>>
  ): void {
    // Include userId to prevent updating another user's meal plan (BUG-14)
    const userId = this.db.getCurrentUserId();
    const existing = this.db.query<MealPlan>('SELECT * FROM meal_plans WHERE id = ? AND userId = ?', [id, userId]);

    if (existing.length === 0) {
      throw new Error(`Meal plan ${id} not found`);
    }

    const now = new Date().toISOString();
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.date !== undefined) {
      setClauses.push('date = ?');
      params.push(updates.date);
    }
    if (updates.mealType !== undefined) {
      setClauses.push('mealType = ?');
      params.push(updates.mealType);
    }
    if (updates.recipeId !== undefined) {
      setClauses.push('recipeId = ?');
      params.push(updates.recipeId);
    }
    if (updates.servings !== undefined) {
      setClauses.push('servings = ?');
      params.push(updates.servings);
    }
    if (updates.notes !== undefined) {
      setClauses.push('notes = ?');
      params.push(updates.notes);
    }
    if (updates.completed !== undefined) {
      setClauses.push('completed = ?');
      params.push(updates.completed ? 1 : 0);
    }

    if (setClauses.length === 0) {
      return; // No updates
    }

    // Always update version and updatedAt
    setClauses.push('updatedAt = ?', 'version = version + 1');
    params.push(now, id);

    const sql = `UPDATE meal_plans SET ${setClauses.join(', ')} WHERE id = ?`;
    this.db.exec(sql, params);
  }

  /**
   * Remove a meal from the plan (soft delete)
   */
  removeMeal(id: string): void {
    this.db.softDelete('meal_plans', id);
  }

  /**
   * Mark a meal as completed
   */
  markAsCompleted(id: string, completed: boolean = true): void {
    this.updateMeal(id, { completed });
  }

  /**
   * Generate shopping list for a date range
   */
  getShoppingListForPeriod(startDate: string, endDate: string): ShoppingListItem[] {
    // Get all meal plans in the period
    const mealPlans = this.getPlanForDateRange(startDate, endDate);

    if (mealPlans.length === 0) {
      return [];
    }

    // Get unique recipe IDs
    const recipeIds = [...new Set(mealPlans.map(plan => plan.recipeId))];

    // Map to track ingredient totals
    const ingredientMap = new Map<string, ShoppingListItem>();

    // For each meal plan, aggregate ingredients
    for (const plan of mealPlans) {
      // Get recipe ingredients
      const recipeIngredients = this.db.query<any>(
        'SELECT * FROM recipe_ingredients WHERE recipeId = ? AND (isDeleted IS NULL OR isDeleted = 0)',
        [plan.recipeId]
      );

      for (const ri of recipeIngredients) {
        const key = ri.ingredientId;

        if (!ingredientMap.has(key)) {
          // Get ingredient name
          const ingredient = this.db.query<any>(
            'SELECT * FROM ingredients WHERE id = ? AND (isDeleted IS NULL OR isDeleted = 0)',
            [ri.ingredientId]
          )[0];

          ingredientMap.set(key, {
            ingredientId: ri.ingredientId,
            ingredientName: ingredient?.name || 'Unknown',
            totalQuantity: 0,
            unit: ri.unit,
            inventoryQuantity: 0,
            needed: 0,
            mealPlans: [],
          });
        }

        const item = ingredientMap.get(key)!;
        // Scale quantity by servings
        item.totalQuantity += ri.quantity * plan.servings;
        if (!item.mealPlans.includes(plan.recipeName || '')) {
          item.mealPlans.push(plan.recipeName || 'Unknown Recipe');
        }
      }
    }

    // Check inventory for each ingredient
    for (const [ingredientId, item] of ingredientMap.entries()) {
      const inventoryItems = this.db.queryByUser<any>(
        'inventory',
        'ingredientId = ?',
        [ingredientId]
      );

      // Sum up inventory quantity (convert units if needed - simplified for now)
      item.inventoryQuantity = inventoryItems.reduce((sum, inv) => {
        // TODO: Unit conversion if inv.unit !== item.unit
        return sum + (inv.unit === item.unit ? inv.quantity : 0);
      }, 0);

      item.needed = Math.max(0, item.totalQuantity - item.inventoryQuantity);
    }

    return Array.from(ingredientMap.values());
  }

  /**
   * Check if inventory has enough ingredients for a meal plan
   */
  checkInventoryForPlan(mealPlanId: string): {
    hasEnough: boolean;
    missing: Array<{ ingredientName: string; needed: number; unit: string }>;
  } {
    const plan = this.db.query<MealPlan>('SELECT * FROM meal_plans WHERE id = ?', [mealPlanId])[0];

    if (!plan) {
      throw new Error(`Meal plan ${mealPlanId} not found`);
    }

    const recipeIngredients = this.db.query<any>(
      'SELECT * FROM recipe_ingredients WHERE recipeId = ? AND (isDeleted IS NULL OR isDeleted = 0)',
      [plan.recipeId]
    );

    const missing: Array<{ ingredientName: string; needed: number; unit: string }> = [];

    for (const ri of recipeIngredients) {
      const neededQuantity = ri.quantity * plan.servings;
      const inventoryItems = this.db.queryByUser<any>('inventory', 'ingredientId = ?', [ri.ingredientId]);

      const totalInventory = inventoryItems.reduce((sum, inv) => {
        return sum + (inv.unit === ri.unit ? inv.quantity : 0);
      }, 0);

      if (totalInventory < neededQuantity) {
        const ingredient = this.db.query<any>('SELECT * FROM ingredients WHERE id = ?', [ri.ingredientId])[0];
        missing.push({
          ingredientName: ingredient?.name || 'Unknown',
          needed: neededQuantity - totalInventory,
          unit: ri.unit,
        });
      }
    }

    return {
      hasEnough: missing.length === 0,
      missing,
    };
  }

  /**
   * Get all meal plans grouped by date
   */
  getPlansGroupedByDate(startDate: string, endDate: string): Map<string, MealPlanWithRecipe[]> {
    const plans = this.getPlanForDateRange(startDate, endDate);
    const grouped = new Map<string, MealPlanWithRecipe[]>();

    for (const plan of plans) {
      if (!grouped.has(plan.date)) {
        grouped.set(plan.date, []);
      }
      grouped.get(plan.date)!.push(plan);
    }

    return grouped;
  }

  /**
   * Enrich meal plans with recipe data
   */
  private enrichWithRecipeData(plans: MealPlan[]): MealPlanWithRecipe[] {
    return plans.map(plan => {
      const recipe = this.db.query<any>('SELECT * FROM recipes WHERE id = ?', [plan.recipeId])[0];
      return {
        ...plan,
        recipeName: recipe?.name,
        recipeSteps: recipe?.steps,
      };
    });
  }

  /**
   * Format Date object to YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
