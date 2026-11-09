import { signal } from '@angular/core';
import { of } from 'rxjs';
import { MealPlanCalendarComponent } from './meal-plan-calendar.component';
import { MealPlanWithRecipe } from '../../core/services/meal-plan.service';

function bare(): MealPlanCalendarComponent & Record<string, any> {
  const component = Object.create(
    MealPlanCalendarComponent.prototype
  ) as MealPlanCalendarComponent & Record<string, any>;
  component.currentDate = signal(new Date(2026, 5, 15));
  component.mealPlans = signal<MealPlanWithRecipe[]>([]);
  component.viewMode = signal<'calendar' | 'agenda'>('calendar');
  component.destroyRef = { onDestroy: () => () => {} };
  component.mealPlanService = {
    getPlanForMonth: vi.fn(() => []),
    markAsCompleted: vi.fn(),
    removeMeal: vi.fn(),
  };
  component.dialog = { open: vi.fn() };
  component.snackbar = { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() };
  component.dataEvents = { emit: vi.fn(), on: vi.fn(() => of(null)) };
  component.db = {
    getRecipeIngredients: vi.fn(() => []),
    getInventoryForIngredient: vi.fn(() => []),
    setInventoryQuantity: vi.fn(),
  };
  component.unitConverter = { convert: vi.fn((qty: number) => qty) };
  component.errorHandler = { handle: vi.fn() };
  return component;
}

function meal(overrides: Partial<MealPlanWithRecipe> = {}): MealPlanWithRecipe {
  return {
    id: 'm1',
    userId: 'u1',
    date: '2026-06-15',
    mealType: 'dinner',
    recipeId: 'r1',
    recipeName: 'Soup',
    servings: 2,
    completed: false,
    version: 1,
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as MealPlanWithRecipe;
}

describe('MealPlanCalendarComponent', () => {
  describe('loadMealPlans / navigation', () => {
    it('loads meal plans for the current month', () => {
      const component = bare();
      const plans = [meal()];
      component.mealPlanService.getPlanForMonth.mockReturnValue(plans);

      component.loadMealPlans();

      expect(component.mealPlanService.getPlanForMonth).toHaveBeenCalledWith(2026, 5);
      expect(component.mealPlans()).toBe(plans);
    });

    it('previousMonth steps back a month and reloads', () => {
      const component = bare();
      component.loadMealPlans = vi.fn();

      component.previousMonth();

      expect(component.currentDate()).toEqual(new Date(2026, 4, 1));
      expect(component.loadMealPlans).toHaveBeenCalled();
    });

    it('nextMonth steps forward a month and reloads', () => {
      const component = bare();
      component.loadMealPlans = vi.fn();

      component.nextMonth();

      expect(component.currentDate()).toEqual(new Date(2026, 6, 1));
    });

    it('goToToday resets to the current date', () => {
      vi.setSystemTime(new Date(2026, 7, 1));
      const component = bare();
      component.loadMealPlans = vi.fn();

      component.goToToday();

      expect(component.currentDate()).toEqual(new Date(2026, 7, 1));
      vi.useRealTimers();
    });
  });

  describe('dialog-driven actions', () => {
    it('shows success when a meal is added via the quick-add dialog', () => {
      const component = bare();
      component.dialog.open.mockReturnValue({ afterClosed: () => of(true) });

      component.openAddDialog();

      expect(component.snackbar.success).toHaveBeenCalledWith('Meal added to plan!');
    });

    it('does nothing when the add dialog is cancelled', () => {
      const component = bare();
      component.dialog.open.mockReturnValue({ afterClosed: () => of(false) });

      component.addMealToSlot('2026-06-15', 'lunch');

      expect(component.snackbar.success).not.toHaveBeenCalled();
    });

    it('shows success when a meal is updated', () => {
      const component = bare();
      component.dialog.open.mockReturnValue({ afterClosed: () => of(true) });

      component.editMeal(meal());

      expect(component.snackbar.success).toHaveBeenCalledWith('Meal updated!');
    });

    it('deletes the meal when confirmed', () => {
      const component = bare();
      component.loadMealPlans = vi.fn();
      component.dialog.open.mockReturnValue({ afterClosed: () => of(true) });

      component.deleteMeal(meal());

      expect(component.mealPlanService.removeMeal).toHaveBeenCalledWith('m1');
      expect(component.dataEvents.emit).toHaveBeenCalledWith('meal_plans', 'delete', 'm1');
      expect(component.snackbar.success).toHaveBeenCalledWith('Meal removed from plan');
    });

    it('does not delete the meal when cancelled', () => {
      const component = bare();
      component.dialog.open.mockReturnValue({ afterClosed: () => of(false) });

      component.deleteMeal(meal());

      expect(component.mealPlanService.removeMeal).not.toHaveBeenCalled();
    });
  });

  describe('toggleCompleted', () => {
    it('marks a completed meal as incomplete without prompting', () => {
      const component = bare();
      component.loadMealPlans = vi.fn();

      component.toggleCompleted(meal({ completed: true }));

      expect(component.mealPlanService.markAsCompleted).toHaveBeenCalledWith('m1', false);
      expect(component.dialog.open).not.toHaveBeenCalled();
      expect(component.snackbar.success).toHaveBeenCalledWith('Marked as incomplete');
    });

    it('marks complete without deducting when the prompt is skipped', () => {
      const component = bare();
      component.loadMealPlans = vi.fn();
      component.dialog.open.mockReturnValue({ afterClosed: () => of(false) });

      component.toggleCompleted(meal({ completed: false }));

      expect(component.mealPlanService.markAsCompleted).toHaveBeenCalledWith('m1', true);
      expect(component.snackbar.success).toHaveBeenCalledWith('Marked as complete');
    });

    it('marks complete and deducts ingredients when confirmed', () => {
      const component = bare();
      component.loadMealPlans = vi.fn();
      component.dialog.open.mockReturnValue({ afterClosed: () => of(true) });
      component.deductIngredients = vi.fn();

      component.toggleCompleted(meal({ completed: false }));

      expect(component.deductIngredients).toHaveBeenCalled();
    });
  });

  describe('deductIngredients', () => {
    it('reports completion with nothing to deduct when the recipe has no ingredients', () => {
      const component = bare();
      component.db.getRecipeIngredients.mockReturnValue([]);

      component.deductIngredients(meal());

      expect(component.snackbar.success).toHaveBeenCalledWith(
        'Marked as complete (no ingredients to deduct)'
      );
      expect(component.db.setInventoryQuantity).not.toHaveBeenCalled();
    });

    it('fully deducts a single ingredient from one matching inventory row', () => {
      const component = bare();
      component.db.getRecipeIngredients.mockReturnValue([
        { ingredientId: 'carrot', quantity: 2, unit: 'pcs' },
      ]);
      component.db.getInventoryForIngredient.mockReturnValue([
        { id: 'inv1', quantity: 10, unit: 'pcs' },
      ]);

      component.deductIngredients(meal({ servings: 2 }));

      expect(component.db.setInventoryQuantity).toHaveBeenCalledWith('inv1', 6, expect.any(String));
      expect(component.dataEvents.emit).toHaveBeenCalledWith('inventory', 'update');
      expect(component.snackbar.success).toHaveBeenCalledWith(
        'Marked as complete — deducted 1 ingredient(s)'
      );
    });

    it('partially depletes multiple rows before fully covering the need', () => {
      const component = bare();
      component.db.getRecipeIngredients.mockReturnValue([
        { ingredientId: 'carrot', quantity: 5, unit: 'pcs' },
      ]);
      component.db.getInventoryForIngredient.mockReturnValue([
        { id: 'inv1', quantity: 2, unit: 'pcs' },
        { id: 'inv2', quantity: 10, unit: 'pcs' },
      ]);

      component.deductIngredients(meal({ servings: 1 }));

      expect(component.db.setInventoryQuantity).toHaveBeenCalledWith('inv1', 0, expect.any(String));
      expect(component.db.setInventoryQuantity).toHaveBeenCalledWith('inv2', 7, expect.any(String));
    });

    it('skips ingredients whose inventory unit cannot be converted and warns', () => {
      const component = bare();
      component.unitConverter.convert.mockReturnValue(null);
      component.db.getRecipeIngredients.mockReturnValue([
        { ingredientId: 'flour', quantity: 1, unit: 'kg' },
      ]);
      component.db.getInventoryForIngredient.mockReturnValue([{ id: 'inv1', quantity: 1, unit: 'L' }]);

      component.deductIngredients(meal({ servings: 1 }));

      expect(component.db.setInventoryQuantity).not.toHaveBeenCalled();
      expect(component.snackbar.warning).toHaveBeenCalledWith(
        'Marked as complete — deducted 0, skipped 1 (unit mismatch or low stock)'
      );
    });

    it('routes a thrown error through the error handler', () => {
      const component = bare();
      component.db.getRecipeIngredients.mockImplementation(() => {
        throw new Error('db locked');
      });

      component.deductIngredients(meal());

      expect(component.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to deduct ingredients'
      );
    });
  });

  describe('getMealIcon / getMealTooltip', () => {
    it('maps known meal types to icons and falls back for unknown ones', () => {
      const component = bare();
      expect(component.getMealIcon('breakfast')).toBe('free_breakfast');
      expect(component.getMealIcon('brunch')).toBe('restaurant');
    });

    it('builds a tooltip with servings and notes when present', () => {
      const component = bare();
      const tooltip = component.getMealTooltip(meal({ servings: 3, notes: 'Extra spicy' } as any));
      expect(tooltip).toBe('Soup (3 servings)\nExtra spicy');
    });

    it('omits the servings suffix for a single serving and no notes', () => {
      const component = bare();
      const tooltip = component.getMealTooltip(meal({ servings: 1, notes: undefined } as any));
      expect(tooltip).toBe('Soup');
    });
  });
});
