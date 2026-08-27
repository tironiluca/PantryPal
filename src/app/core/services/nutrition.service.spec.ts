import { TestBed } from '@angular/core/testing';
import { NutritionService } from './nutrition.service';
import { DbService } from './db.service';
import { AuthService } from './auth.service';
import { ProductsService } from './products.service';

describe('NutritionService', () => {
  let service: NutritionService;
  let dbSpy: {
    query: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
    getRecipeNutritionIngredients: ReturnType<typeof vi.fn>;
    getNutritionLogs: ReturnType<typeof vi.fn>;
    getNutritionGoals: ReturnType<typeof vi.fn>;
  };
  let authSpy: { getCurrentUserId: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dbSpy = {
      query: vi.fn().mockReturnValue([]),
      exec: vi.fn(),
      getRecipeNutritionIngredients: vi.fn().mockReturnValue([]),
      getNutritionLogs: vi.fn().mockReturnValue([]),
      getNutritionGoals: vi.fn().mockReturnValue(undefined),
    };
    authSpy = { getCurrentUserId: vi.fn().mockReturnValue('user-1') };

    TestBed.configureTestingModule({
      providers: [
        { provide: DbService, useValue: dbSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: ProductsService, useValue: {} },
      ],
    });
    service = TestBed.inject(NutritionService);
  });

  describe('getRecipeNutrition', () => {
    it('returns null when the recipe has no ingredients', () => {
      dbSpy.getRecipeNutritionIngredients.mockReturnValue([]);
      expect(service.getRecipeNutrition('recipe-1')).toBeNull();
    });

    it('scales per-100g nutrition values by the ingredient weight in grams', () => {
      dbSpy.getRecipeNutritionIngredients.mockReturnValue([
        { quantity: 200, unit: 'g', energyKcal: 100, proteinG: 10, carbsG: 20, fatG: 5, fiberG: 2, sugarG: 1, sodiumMg: 50 },
      ]);

      const result = service.getRecipeNutrition('recipe-1');

      expect(result).toEqual({
        energyKcal: 200, // 100 kcal/100g * 200g
        proteinG: 20,
        carbsG: 40,
        fatG: 10,
        fiberG: 4,
        sugarG: 2,
        sodiumMg: 100,
      });
    });

    it('converts non-gram weight units before scaling', () => {
      dbSpy.getRecipeNutritionIngredients.mockReturnValue([
        { quantity: 1, unit: 'kg', energyKcal: 100, proteinG: 10, carbsG: 20, fatG: 5 },
      ]);

      const result = service.getRecipeNutrition('recipe-1');

      // 1kg == 1000g == 10x the 100g reference amount
      expect(result?.energyKcal).toBe(1000);
      expect(result?.proteinG).toBe(100);
    });

    it('skips ingredients measured in non-convertible units (e.g. pcs)', () => {
      dbSpy.getRecipeNutritionIngredients.mockReturnValue([
        { quantity: 200, unit: 'g', energyKcal: 100, proteinG: 10, carbsG: 0, fatG: 0 },
        { quantity: 2, unit: 'pcs', energyKcal: 9999, proteinG: 9999, carbsG: 9999, fatG: 9999 },
      ]);

      const result = service.getRecipeNutrition('recipe-1');

      expect(result?.energyKcal).toBe(200);
      expect(result?.proteinG).toBe(20);
    });

    it('sums nutrition across multiple ingredients', () => {
      dbSpy.getRecipeNutritionIngredients.mockReturnValue([
        { quantity: 100, unit: 'g', energyKcal: 50, proteinG: 5, carbsG: 5, fatG: 5 },
        { quantity: 100, unit: 'g', energyKcal: 30, proteinG: 3, carbsG: 3, fatG: 3 },
      ]);

      const result = service.getRecipeNutrition('recipe-1');

      expect(result?.energyKcal).toBe(80);
      expect(result?.proteinG).toBe(8);
    });
  });

  describe('getDailyNutrition', () => {
    it('returns an empty summary for a guest (unauthenticated) user', () => {
      authSpy.getCurrentUserId.mockReturnValue(null);

      const summary = service.getDailyNutrition('2026-01-01');

      expect(summary).toEqual({
        date: '2026-01-01',
        totalKcal: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
        totalSugar: 0,
        totalSodium: 0,
      });
      expect(dbSpy.query).not.toHaveBeenCalled();
    });

    it('aggregates logged meals for the day', () => {
      dbSpy.getNutritionLogs.mockReturnValue([
        { totalKcal: 500, totalProtein: 30, totalCarbs: 40, totalFat: 10, totalFiber: 5, totalSugar: 8, totalSodium: 300 },
        { totalKcal: 300, totalProtein: 20, totalCarbs: 20, totalFat: 5, totalFiber: 2, totalSugar: 4, totalSodium: 200 },
      ]);

      const summary = service.getDailyNutrition('2026-01-01');

      expect(summary.totalKcal).toBe(800);
      expect(summary.totalProtein).toBe(50);
      expect(summary.goals).toBeUndefined();
    });

    it('computes percentage-of-goal fields when goals are set', () => {
      dbSpy.getNutritionLogs.mockReturnValue([
        { totalKcal: 1000, totalProtein: 50, totalCarbs: 100, totalFat: 30 },
      ]);
      dbSpy.getNutritionGoals.mockReturnValue({
        userId: 'user-1',
        dailyKcalGoal: 2000,
        proteinGoal: 100,
        carbsGoal: 200,
        fatGoal: 60,
        trackFiber: 0,
        trackSugar: 0,
        trackSodium: 0,
      });

      const summary = service.getDailyNutrition('2026-01-01');

      expect(summary.percentKcal).toBe(50);
      expect(summary.percentProtein).toBe(50);
      expect(summary.percentCarbs).toBe(50);
      expect(summary.percentFat).toBe(50);
    });
  });

  describe('getGoals', () => {
    it('returns null for a guest (unauthenticated) user', () => {
      authSpy.getCurrentUserId.mockReturnValue(null);
      expect(service.getGoals()).toBeNull();
    });

    it('returns null when no goals row exists', () => {
      dbSpy.getNutritionGoals.mockReturnValue(undefined);
      expect(service.getGoals()).toBeNull();
    });

    it('coerces stored 0/1 tracking flags to booleans', () => {
      dbSpy.getNutritionGoals.mockReturnValue({
        userId: 'user-1',
        dailyKcalGoal: 2000,
        proteinGoal: 100,
        carbsGoal: 200,
        fatGoal: 60,
        trackFiber: 1,
        trackSugar: 0,
        trackSodium: 1,
      });

      const goals = service.getGoals();

      expect(goals?.trackFiber).toBe(true);
      expect(goals?.trackSugar).toBe(false);
      expect(goals?.trackSodium).toBe(true);
    });
  });

  describe('setGoals', () => {
    it('throws when called without an authenticated user', () => {
      authSpy.getCurrentUserId.mockReturnValue(null);
      expect(() => service.setGoals({ dailyKcalGoal: 2000, proteinGoal: 100, carbsGoal: 200, fatGoal: 60 })).toThrow();
    });

    it('inserts a new row when no goals exist yet', () => {
      dbSpy.getNutritionGoals.mockReturnValue(undefined); // getGoals() -> no existing row

      service.setGoals({ dailyKcalGoal: 2000, proteinGoal: 100, carbsGoal: 200, fatGoal: 60 });

      expect(dbSpy.exec).toHaveBeenCalledTimes(1);
      expect(dbSpy.exec.mock.calls[0][0]).toContain('INSERT INTO nutrition_goals');
    });
  });

  describe('getPresetGoals', () => {
    it('returns the weight_loss preset', () => {
      expect(service.getPresetGoals('weight_loss')).toMatchObject({ dailyKcalGoal: 1500, goalType: 'weight_loss' });
    });

    it('falls back to the default goals for an unknown preset', () => {
      expect(service.getPresetGoals('unknown')).toEqual(service.getPresetGoals('nonexistent'));
    });
  });
});
