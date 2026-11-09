import { signal } from '@angular/core';
import { of } from 'rxjs';
import { NutritionDashboardComponent } from './nutrition-dashboard.component';

function bare(): NutritionDashboardComponent & Record<string, any> {
  const component = Object.create(NutritionDashboardComponent.prototype) as NutritionDashboardComponent & Record<string, any>;
  component.summary = signal(null);
  component.hasGoals = signal(false);
  component.nutritionService = {
    getDailyNutrition: vi.fn(() => ({ date: '2026-01-01', totalKcal: 0 })),
    getGoals: vi.fn(() => null),
    getDefaultGoals: vi.fn(() => ({ dailyKcalGoal: 2000 })),
    setGoals: vi.fn(),
  };
  component.snackbar = { success: vi.fn() };
  component.dialog = { open: vi.fn(() => ({ afterClosed: () => of(null) })) };
  component.destroyRef = { onDestroy: vi.fn(() => () => {}) };
  return component;
}

describe('NutritionDashboardComponent', () => {
  describe('loadTodayNutrition', () => {
    it('loads today\'s summary using a local YYYY-MM-DD date', () => {
      const component = bare();

      component.loadTodayNutrition();

      expect(component.nutritionService.getDailyNutrition).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
      expect(component.summary()).toEqual({ date: '2026-01-01', totalKcal: 0 });
    });

    it('reports no goals when the summary carries none', () => {
      const component = bare();
      component.loadTodayNutrition();
      expect(component.hasGoals()).toBe(false);
    });

    it('reports goals when the summary carries them', () => {
      const component = bare();
      component.nutritionService.getDailyNutrition.mockReturnValue({ totalKcal: 0, goals: { dailyKcalGoal: 2000 } });
      component.loadTodayNutrition();
      expect(component.hasGoals()).toBe(true);
    });

    it('runs on init', () => {
      const component = bare();
      component.ngOnInit();
      expect(component.nutritionService.getDailyNutrition).toHaveBeenCalled();
    });
  });

  describe('setGoals', () => {
    it('opens the goals dialog in create mode with defaults when no goals exist', () => {
      const component = bare();

      component.setGoals();

      expect(component.dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        data: { goals: { dailyKcalGoal: 2000 }, isEdit: false },
      }));
    });

    it('opens the goals dialog in edit mode with the current goals', () => {
      const component = bare();
      component.nutritionService.getGoals.mockReturnValue({ dailyKcalGoal: 1800 });

      component.setGoals();

      expect(component.dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        data: { goals: { dailyKcalGoal: 1800 }, isEdit: true },
      }));
    });

    it('saves returned goals, reloads, and confirms', () => {
      const component = bare();
      const result = { dailyKcalGoal: 2200 };
      component.dialog.open.mockReturnValue({ afterClosed: () => of(result) });

      component.setGoals();

      expect(component.nutritionService.setGoals).toHaveBeenCalledWith(result);
      expect(component.nutritionService.getDailyNutrition).toHaveBeenCalled();
      expect(component.snackbar.success).toHaveBeenCalledWith('Nutrition goals saved!');
    });

    it('does nothing when the dialog is cancelled', () => {
      const component = bare();

      component.setGoals();

      expect(component.nutritionService.setGoals).not.toHaveBeenCalled();
      expect(component.snackbar.success).not.toHaveBeenCalled();
    });
  });

  describe('getProgressColor', () => {
    it('is primary within 90-110%', () => {
      const component = bare();
      expect(component.getProgressColor(90)).toBe('primary');
      expect(component.getProgressColor(110)).toBe('primary');
    });

    it('is warn below 70% or above 130%', () => {
      const component = bare();
      expect(component.getProgressColor(69)).toBe('warn');
      expect(component.getProgressColor(131)).toBe('warn');
    });

    it('is accent in the near-miss bands', () => {
      const component = bare();
      expect(component.getProgressColor(75)).toBe('accent');
      expect(component.getProgressColor(120)).toBe('accent');
    });
  });

  describe('getCaloriePercent', () => {
    it('returns 0 without a summary or with zero calories', () => {
      const component = bare();
      expect(component.getCaloriePercent(10, 4)).toBe(0);
      component.summary.set({ totalKcal: 0 } as any);
      expect(component.getCaloriePercent(10, 4)).toBe(0);
    });

    it('returns the macro\'s share of total calories', () => {
      const component = bare();
      component.summary.set({ totalKcal: 400 } as any);
      expect(component.getCaloriePercent(25, 4)).toBe(25);
    });
  });
});
