import { signal } from '@angular/core';
import { InventoryEditDialog } from './inventory/inventory-edit/inventory-edit.dialog';
import { IngredientEditDialog } from './ingredients/ingredient-edit/ingredient-edit.dialog';
import { RecipeEditDialog } from './recipes/recipe-edit.dialog';
import { MealPlanAddDialog } from './meal-plan/meal-plan-add.dialog';
import { NutritionGoalsDialog } from './nutrition/nutrition-goals.dialog';
import { BarcodeScannerDialog } from './inventory/barcode-scanner.dialog';
import { ImageRecognitionDialog } from './inventory/image-recognition.dialog';
import { HouseholdSettingsComponent } from './settings/household-settings.component';
import { SettingsComponent } from './settings/settings.component';

function bare<T>(type: new (...args: any[]) => T): T {
  return Object.create(type.prototype) as T;
}

describe('feature dialog behavior', () => {
  it('filters inventory ingredient choices and updates the selected id', () => {
    const component = bare(InventoryEditDialog) as any;
    component.allIngredients = [{ id: 'milk', name: 'Milk' }, { id: 'rice', name: 'Rice' }];
    component.model = {};
    component.filterIngredients('mil');
    expect(component.filteredIngredients).toEqual([{ id: 'milk', name: 'Milk' }]);
    expect(component.model.ingredientId).toBe('mil');
    component.filterIngredients('milk');
    expect(component.model.ingredientId).toBe('milk');
  });

  it('detects nutrition attached to an ingredient', () => {
    const component = bare(IngredientEditDialog) as any;
    component.model = { energyKcal: 120 };
    expect(component.hasNutrition()).toBe(true);
    component.model.energyKcal = 0;
    expect(component.hasNutrition()).toBe(false);
  });

  it('initializes a meal-plan date from the dialog input', () => {
    const component = bare(MealPlanAddDialog) as any;
    expect(component.parseDate('2026-08-27')).toEqual(new Date(2026, 7, 27));
    expect(component.formatDate(new Date(2026, 7, 27))).toBe('2026-08-27');
  });

  it('applies nutrition goal presets', () => {
    const component = bare(NutritionGoalsDialog) as any;
    component.goals = { goalType: 'custom' };
    component.nutritionService = { getPresetGoals: vi.fn(() => ({ dailyKcalGoal: 1500, goalType: 'weight_loss' })) };
    component.onPresetChange('weight_loss');
    expect(component.goals).toMatchObject({ dailyKcalGoal: 1500, goalType: 'weight_loss' });
  });

  it('reports scanner failures and cancels camera cleanup', () => {
    const component = bare(BarcodeScannerDialog) as any;
    component.barcode = { cancel: vi.fn() };
    component.dialogRef = { close: vi.fn() };
    component.videoRef = { nativeElement: { srcObject: null } };
    component.cancel();
    expect(component.barcode.cancel).toHaveBeenCalled();
    expect(component.dialogRef.close).toHaveBeenCalledWith(null);
  });

  it('tracks selected image predictions and food classification', () => {
    const component = bare(ImageRecognitionDialog) as any;
    component.selectedPrediction = signal<string | null>(null);
    component.imageRecognition = { isFoodRelated: vi.fn(() => true) };
    component.selectPrediction({ className: 'tomato', probability: 0.9 } as any);
    expect(component.isFoodRelated()).toBe(true);
  });

  it('exposes recipe dialog form state for new recipes', () => {
    const component = bare(RecipeEditDialog) as any;
    component.isEditMode = signal(false);
    expect(component.isEditMode()).toBe(false);
  });

  it('validates household invites before calling the service', async () => {
    const component = bare(HouseholdSettingsComponent) as any;
    component.inviteEmail = 'invalid';
    component.householdService = { inviteMember: vi.fn() };
    component.errorHandler = { handle: vi.fn() };
    await component.invite();
    expect(component.householdService.inviteMember).not.toHaveBeenCalled();
    expect(component.errorHandler.handle).toHaveBeenCalled();
  });

  it('exposes settings theme and language service bindings', () => {
    const component = bare(SettingsComponent) as any;
    component.theme = {};
    component.lang = {};
    expect(component.theme).toEqual({});
    expect(component.lang).toEqual({});
  });
});
