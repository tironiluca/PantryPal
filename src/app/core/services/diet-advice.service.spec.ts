import { TestBed } from '@angular/core/testing';
import { DietAdviceService } from './diet-advice.service';
import { DbService } from './db.service';
import { AuthService } from './auth.service';
import { NutritionService, DailyNutritionSummary, NutritionGoals } from './nutrition.service';

describe('DietAdviceService', () => {
  let service: DietAdviceService;
  let dbSpy: {
    query: ReturnType<typeof vi.fn>;
    queryByUser: ReturnType<typeof vi.fn>;
    getRecipeIngredients: ReturnType<typeof vi.fn>;
    getInventoryForIngredient: ReturnType<typeof vi.fn>;
    getExpiringInventory: ReturnType<typeof vi.fn>;
    getRecipesUsingIngredients: ReturnType<typeof vi.fn>;
  };
  let authSpy: { getCurrentUserId: ReturnType<typeof vi.fn> };
  let nutritionSpy: { getRecipeNutrition: ReturnType<typeof vi.fn> };

  const goals: NutritionGoals = {
    userId: 'user-1',
    dailyKcalGoal: 2000,
    proteinGoal: 100,
    carbsGoal: 250,
    fatGoal: 65,
    fiberGoal: 25,
    trackFiber: true,
  };

  const emptySummary: DailyNutritionSummary = {
    date: '2026-01-01',
    totalKcal: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFiber: 0,
    totalSugar: 0,
    totalSodium: 0,
  };

  beforeEach(() => {
    dbSpy = {
      query: vi.fn().mockReturnValue([]),
      queryByUser: vi.fn().mockReturnValue([]),
      getRecipeIngredients: vi.fn().mockReturnValue([]),
      getInventoryForIngredient: vi.fn().mockReturnValue([]),
      getExpiringInventory: vi.fn().mockReturnValue([]),
      getRecipesUsingIngredients: vi.fn().mockReturnValue([]),
    };
    authSpy = { getCurrentUserId: vi.fn().mockReturnValue(null) };
    nutritionSpy = { getRecipeNutrition: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: DbService, useValue: dbSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: NutritionService, useValue: nutritionSpy },
      ],
    });
    service = TestBed.inject(DietAdviceService);
  });

  describe('generateAdvice', () => {
    it('computes remaining macros as goal minus consumed, floored at zero', () => {
      const summary: DailyNutritionSummary = {
        ...emptySummary,
        totalKcal: 1500,
        totalProtein: 120, // already over the goal
        totalCarbs: 100,
        totalFat: 20,
      };

      const advice = service.generateAdvice(summary, goals);

      expect(advice.remainingKcal).toBe(500);
      expect(advice.remainingProtein).toBe(0); // clamped, not negative
      expect(advice.remainingCarbs).toBe(150);
      expect(advice.remainingFat).toBe(45);
    });

    it('returns no recipe suggestions for an unauthenticated (guest) user', () => {
      authSpy.getCurrentUserId.mockReturnValue(null);

      const advice = service.generateAdvice(emptySummary, goals);

      expect(advice.suggestedRecipes).toEqual([]);
      expect(dbSpy.query).not.toHaveBeenCalled();
    });

    it('warns when the calorie goal has been exceeded by more than 10%', () => {
      const summary: DailyNutritionSummary = { ...emptySummary, totalKcal: 2300 };

      const advice = service.generateAdvice(summary, goals);

      expect(advice.insights.some(i => i.includes('exceeded your calorie goal'))).toBe(true);
    });

    it('flags low protein intake relative to the goal', () => {
      const summary: DailyNutritionSummary = { ...emptySummary, totalKcal: 1900, totalProtein: 20 };

      const advice = service.generateAdvice(summary, goals);

      expect(advice.insights.some(i => i.toLowerCase().includes('protein'))).toBe(true);
    });

    it('falls back to an encouraging message when nothing stands out', () => {
      // kcal/protein/carbs all comfortably mid-range, fiber tracking disabled:
      // none of the specific insight conditions should fire.
      const summary: DailyNutritionSummary = {
        ...emptySummary,
        totalKcal: 1400, // 70% of goal
        totalProtein: 80, // 80% of goal
        totalCarbs: 100, // 40% of goal
      };

      const advice = service.generateAdvice(summary, { ...goals, trackFiber: false });

      expect(advice.insights).toEqual([
        'Keep up the good work! Your nutrition is well balanced today.',
      ]);
    });

    it('recommends a meal type consistent with the current hour', () => {
      const advice = service.generateAdvice(emptySummary, goals);
      expect(['breakfast', 'lunch', 'dinner', 'snack']).toContain(advice.mealTypeRecommendation);
    });
  });

  describe('getIngredientAvailability', () => {
    it('returns 100 when a recipe has no ingredients to check', () => {
      dbSpy.getRecipeIngredients.mockReturnValue([]);
      expect(service.getIngredientAvailability('recipe-1', 'user-1')).toBe(100);
    });

    it('computes the percentage of ingredients currently in stock', () => {
      dbSpy.getRecipeIngredients.mockReturnValue([{ ingredientId: 'a' }, { ingredientId: 'b' }]);
      dbSpy.getInventoryForIngredient
        .mockReturnValueOnce([{ id: 'inv-a' }])
        .mockReturnValueOnce([]);

      expect(service.getIngredientAvailability('recipe-1', 'user-1')).toBe(50);
    });
  });

  describe('getUseItUpSuggestions', () => {
    it('returns empty suggestions when nothing is expiring soon', () => {
      authSpy.getCurrentUserId.mockReturnValue('user-1');
      dbSpy.getExpiringInventory.mockReturnValue([]);

      const result = service.getUseItUpSuggestions(3);

      expect(result).toEqual({ expiringItems: [], matchedRecipes: [] });
    });
  });
});
