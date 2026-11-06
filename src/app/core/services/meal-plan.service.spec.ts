import { MealPlanService } from './meal-plan.service';

function bare(): MealPlanService & Record<string, any> {
  return Object.create(MealPlanService.prototype) as MealPlanService & Record<string, any>;
}

function recipeLookup(recipes: Record<string, { name: string; steps: string }>) {
  return (id: string) => recipes[id];
}

describe('MealPlanService', () => {
  describe('plan lookups', () => {
    it('enriches meal plans for a date with their recipe name and steps', () => {
      const service = bare();
      service.db = {
        queryByUser: vi.fn(() => [
          { id: 'm1', recipeId: 'r1', date: '2026-06-01' },
        ]),
        getRecipe: vi.fn(recipeLookup({ r1: { name: 'Pasta', steps: 'Boil' } })),
      };

      const result = service.getPlanForDate('2026-06-01');

      expect(service.db.queryByUser).toHaveBeenCalledWith('meal_plans', 'date = ?', ['2026-06-01']);
      expect(result).toEqual([
        { id: 'm1', recipeId: 'r1', date: '2026-06-01', recipeName: 'Pasta', recipeSteps: 'Boil' },
      ]);
    });

    it('queries an inclusive date range', () => {
      const service = bare();
      service.db = {
        queryByUser: vi.fn(() => []),
        getRecipe: vi.fn(),
      };

      service.getPlanForDateRange('2026-06-01', '2026-06-07');

      expect(service.db.queryByUser).toHaveBeenCalledWith(
        'meal_plans',
        'date >= ? AND date <= ?',
        ['2026-06-01', '2026-06-07']
      );
    });

    it('computes a 7-day window for the week view', () => {
      const service = bare();
      const queryByUser = vi.fn(() => []);
      service.db = { queryByUser, getRecipe: vi.fn() };

      service.getPlanForWeek(new Date(2026, 5, 1));

      expect(queryByUser).toHaveBeenCalledWith(
        'meal_plans',
        'date >= ? AND date <= ?',
        ['2026-06-01', '2026-06-07']
      );
    });

    it('computes the first and last day of the given month', () => {
      const service = bare();
      const queryByUser = vi.fn(() => []);
      service.db = { queryByUser, getRecipe: vi.fn() };

      service.getPlanForMonth(2026, 1); // February 2026 (zero-indexed month)

      expect(queryByUser).toHaveBeenCalledWith(
        'meal_plans',
        'date >= ? AND date <= ?',
        ['2026-02-01', '2026-02-28']
      );
    });
  });

  describe('addMeal', () => {
    it('throws when no user is authenticated', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      expect(() => service.addMeal('2026-06-01', 'dinner', 'r1')).toThrow(
        'User must be authenticated to add meal plans'
      );
    });

    it('inserts a new meal plan row and returns it', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { exec: vi.fn() };

      const plan = service.addMeal('2026-06-01', 'dinner', 'r1', 2, 'extra spicy');

      expect(plan).toMatchObject({
        userId: 'u1',
        date: '2026-06-01',
        mealType: 'dinner',
        recipeId: 'r1',
        servings: 2,
        notes: 'extra spicy',
        completed: false,
        version: 1,
        isDeleted: false,
      });
      expect(service.db.exec).toHaveBeenCalledTimes(1);
      const [sql, params] = service.db.exec.mock.calls[0];
      expect(sql).toContain('INSERT INTO meal_plans');
      expect(params).toEqual([
        plan.id,
        'u1',
        '2026-06-01',
        'dinner',
        'r1',
        2,
        'extra spicy',
        0,
        1,
        0,
        plan.createdAt,
        plan.updatedAt,
      ]);
    });

    it('defaults servings to 1 and notes to an empty string', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { exec: vi.fn() };

      const plan = service.addMeal('2026-06-01', 'breakfast', 'r1');

      expect(plan.servings).toBe(1);
      expect(plan.notes).toBe('');
    });
  });

  describe('updateMeal', () => {
    it('throws when the meal plan does not exist', () => {
      const service = bare();
      service.db = { getCurrentUserId: () => 'u1', getMealPlan: vi.fn(() => []) };

      expect(() => service.updateMeal('missing', { servings: 2 })).toThrow('Meal plan missing not found');
    });

    it('is a no-op when no fields are provided', () => {
      const service = bare();
      service.db = {
        getCurrentUserId: () => 'u1',
        getMealPlan: vi.fn(() => [{ id: 'm1' }]),
        exec: vi.fn(),
      };

      service.updateMeal('m1', {});

      expect(service.db.exec).not.toHaveBeenCalled();
    });

    it('builds an update statement for only the provided fields', () => {
      const service = bare();
      service.db = {
        getCurrentUserId: () => 'u1',
        getMealPlan: vi.fn(() => [{ id: 'm1' }]),
        exec: vi.fn(),
      };

      service.updateMeal('m1', { servings: 4, completed: true });

      expect(service.db.exec).toHaveBeenCalledTimes(1);
      const [sql, params] = service.db.exec.mock.calls[0];
      expect(sql).toBe(
        'UPDATE meal_plans SET servings = ?, completed = ?, updatedAt = ?, version = version + 1 WHERE id = ?'
      );
      expect(params).toEqual([4, 1, expect.any(String), 'm1']);
    });
  });

  describe('removeMeal / markAsCompleted', () => {
    it('soft-deletes the meal plan row', () => {
      const service = bare();
      service.db = { softDelete: vi.fn() };

      service.removeMeal('m1');

      expect(service.db.softDelete).toHaveBeenCalledWith('meal_plans', 'm1');
    });

    it('delegates markAsCompleted to updateMeal', () => {
      const service = bare();
      service.updateMeal = vi.fn();

      service.markAsCompleted('m1');
      expect(service.updateMeal).toHaveBeenCalledWith('m1', { completed: true });

      service.markAsCompleted('m1', false);
      expect(service.updateMeal).toHaveBeenCalledWith('m1', { completed: false });
    });
  });

  describe('getShoppingListForPeriod', () => {
    it('returns an empty list when there are no meal plans', () => {
      const service = bare();
      service.db = { queryByUser: vi.fn(() => []), getRecipe: vi.fn() };

      expect(service.getShoppingListForPeriod('2026-06-01', '2026-06-07')).toEqual([]);
    });

    it('aggregates ingredient quantities across meal plans, scaled by servings', () => {
      const service = bare();
      service.db = {
        queryByUser: vi.fn(() => [
          { id: 'm1', recipeId: 'r1', servings: 2, date: '2026-06-01' },
          { id: 'm2', recipeId: 'r2', servings: 1, date: '2026-06-02' },
        ]),
        getRecipe: vi.fn(recipeLookup({ r1: { name: 'Soup' }, r2: { name: 'Salad' } } as any)),
        getRecipeIngredients: vi.fn((recipeId: string) =>
          recipeId === 'r1'
            ? [{ ingredientId: 'carrot', quantity: 2, unit: 'pcs' }]
            : [{ ingredientId: 'carrot', quantity: 1, unit: 'pcs' }]
        ),
        getIngredientsByIds: vi.fn(() => [{ id: 'carrot', name: 'Carrot' }]),
        getIngredientInventory: vi.fn(() => ({ inventory: [{ quantity: 3, unit: 'pcs' }] })),
      };

      const list = service.getShoppingListForPeriod('2026-06-01', '2026-06-07');

      expect(list).toEqual([
        {
          ingredientId: 'carrot',
          ingredientName: 'Carrot',
          totalQuantity: 5, // 2*2 (soup) + 1*1 (salad)
          unit: 'pcs',
          inventoryQuantity: 3,
          needed: 2,
          mealPlans: ['Soup', 'Salad'],
        },
      ]);
    });

    it('ignores inventory in a different unit when computing the shortage', () => {
      const service = bare();
      service.db = {
        queryByUser: vi.fn(() => [{ id: 'm1', recipeId: 'r1', servings: 1, date: '2026-06-01' }]),
        getRecipe: vi.fn(recipeLookup({ r1: { name: 'Soup' } } as any)),
        getRecipeIngredients: vi.fn(() => [{ ingredientId: 'flour', quantity: 500, unit: 'g' }]),
        getIngredientsByIds: vi.fn(() => [{ id: 'flour', name: 'Flour' }]),
        getIngredientInventory: vi.fn(() => ({ inventory: [{ quantity: 2, unit: 'pcs' }] })),
      };

      const [item] = service.getShoppingListForPeriod('2026-06-01', '2026-06-07');

      expect(item.inventoryQuantity).toBe(0);
      expect(item.needed).toBe(500);
    });
  });

  describe('checkInventoryForPlan', () => {
    it('throws when the meal plan does not exist', () => {
      const service = bare();
      service.db = { getMealPlan: vi.fn(() => undefined) };

      expect(() => service.checkInventoryForPlan('missing')).toThrow('Meal plan missing not found');
    });

    it('reports hasEnough when inventory covers every ingredient', () => {
      const service = bare();
      service.db = {
        getMealPlan: vi.fn(() => ({ recipeId: 'r1', servings: 2 })),
        getRecipeIngredients: vi.fn(() => [{ ingredientId: 'egg', quantity: 2, unit: 'pcs' }]),
        getIngredientInventory: vi.fn(() => ({ inventory: [{ quantity: 10, unit: 'pcs' }] })),
      };

      expect(service.checkInventoryForPlan('m1')).toEqual({ hasEnough: true, missing: [] });
    });

    it('lists missing ingredients with the quantity still needed', () => {
      const service = bare();
      service.db = {
        getMealPlan: vi.fn(() => ({ recipeId: 'r1', servings: 3 })),
        getRecipeIngredients: vi.fn(() => [{ ingredientId: 'egg', quantity: 2, unit: 'pcs' }]),
        getIngredientInventory: vi.fn(() => ({ inventory: [{ quantity: 1, unit: 'pcs' }] })),
        getIngredientsByIds: vi.fn(() => [{ id: 'egg', name: 'Egg' }]),
      };

      expect(service.checkInventoryForPlan('m1')).toEqual({
        hasEnough: false,
        missing: [{ ingredientName: 'Egg', needed: 5, unit: 'pcs' }],
      });
    });
  });

  describe('getPlansGroupedByDate', () => {
    it('groups meal plans by their date', () => {
      const service = bare();
      service.db = {
        queryByUser: vi.fn(() => [
          { id: 'm1', date: '2026-06-01', recipeId: 'r1' },
          { id: 'm2', date: '2026-06-01', recipeId: 'r2' },
          { id: 'm3', date: '2026-06-02', recipeId: 'r1' },
        ]),
        getRecipe: vi.fn(() => undefined),
      };

      const grouped = service.getPlansGroupedByDate('2026-06-01', '2026-06-07');

      expect(grouped.get('2026-06-01')?.map((p: any) => p.id)).toEqual(['m1', 'm2']);
      expect(grouped.get('2026-06-02')?.map((p: any) => p.id)).toEqual(['m3']);
    });
  });
});
