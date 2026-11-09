import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoService } from '@jsverse/transloco';
import { MealPlanAddDialog, MealPlanDialogData } from './meal-plan-add.dialog';
import { MealPlanService } from '../../core/services/meal-plan.service';
import { DbService } from '../../core/services/db.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { DataEventsService } from '../../core/services/data-events.service';

describe('MealPlanAddDialog', () => {
  let fixture: ComponentFixture<MealPlanAddDialog>;
  let component: MealPlanAddDialog;
  let mealPlanSpy: { addMeal: ReturnType<typeof vi.fn>; updateMeal: ReturnType<typeof vi.fn> };
  let dbSpy: { queryByUser: ReturnType<typeof vi.fn> };
  let snackbarSpy: { error: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let dataEventsSpy: { emit: ReturnType<typeof vi.fn> };

  async function setup(data: MealPlanDialogData) {
    mealPlanSpy = { addMeal: vi.fn(), updateMeal: vi.fn() };
    dbSpy = { queryByUser: vi.fn().mockReturnValue([{ id: 'r1', name: 'Pancakes' }, { id: 'r2', name: 'Omelette' }]) };
    snackbarSpy = { error: vi.fn() };
    dialogRefSpy = { close: vi.fn() };
    dataEventsSpy = { emit: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MealPlanAddDialog, MatIconTestingModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MealPlanService, useValue: mealPlanSpy },
        { provide: DbService, useValue: dbSpy },
        { provide: SnackbarService, useValue: snackbarSpy },
        { provide: DataEventsService, useValue: dataEventsSpy },
        { provide: TranslocoService, useValue: { translate: vi.fn((key: string) => key) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MealPlanAddDialog);
    component = fixture.componentInstance;
    component.ngOnInit();
  }

  it('starts in create mode defaulting the date, meal type, and recipe from the dialog data', async () => {
    await setup({ date: '2026-03-10', mealType: 'lunch' });

    expect(component.isEditMode).toBe(false);
    expect(component.form.value.date).toEqual(new Date(2026, 2, 10));
    expect(component.form.value.mealType).toBe('lunch');
    expect(component.form.value.servings).toBe(1);
  });

  it('defaults to dinner today when nothing is provided', async () => {
    await setup({});
    const today = new Date();
    expect(component.form.value.mealType).toBe('dinner');
    expect(component.form.value.date.toDateString()).toBe(today.toDateString());
  });

  it('loads the user recipes', async () => {
    await setup({});
    expect(component.recipes()).toEqual([{ id: 'r1', name: 'Pancakes' }, { id: 'r2', name: 'Omelette' }]);
  });

  it('pre-fills the form and selected recipe when editing an existing meal plan', async () => {
    const mealPlan: any = { id: 'mp1', date: '2026-03-10', mealType: 'breakfast', recipeId: 'r1', servings: 2, notes: 'Extra syrup', completed: true };
    await setup({ mealPlan });

    expect(component.isEditMode).toBe(true);
    expect(component.form.value.recipeId).toBe('r1');
    expect(component.form.value.notes).toBe('Extra syrup');
    expect(component.form.value.completed).toBe(true);
    expect(component.selectedRecipe()).toEqual({ id: 'r1', name: 'Pancakes' });
  });

  it('updates the selected recipe when the recipe field changes', async () => {
    await setup({});
    component.form.get('recipeId')?.setValue('r2');
    expect(component.selectedRecipe()).toEqual({ id: 'r2', name: 'Omelette' });
  });

  it('clears the selected recipe when the chosen id does not match any recipe', async () => {
    await setup({});
    component.form.get('recipeId')?.setValue('missing');
    expect(component.selectedRecipe()).toBeNull();
  });

  describe('onSave', () => {
    it('refuses to save an invalid form', async () => {
      await setup({});
      component.form.patchValue({ recipeId: '' });

      component.onSave();

      expect(snackbarSpy.error).toHaveBeenCalledWith('common.fillRequiredFields');
      expect(mealPlanSpy.addMeal).not.toHaveBeenCalled();
    });

    it('adds a new meal plan and closes with true', async () => {
      await setup({ date: '2026-03-10' });
      component.form.patchValue({ recipeId: 'r1', mealType: 'lunch', servings: 3, notes: 'yum' });

      component.onSave();

      expect(mealPlanSpy.addMeal).toHaveBeenCalledWith('2026-03-10', 'lunch', 'r1', 3, 'yum');
      expect(dataEventsSpy.emit).toHaveBeenCalledWith('meal_plans', 'create');
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('updates an existing meal plan and closes with true', async () => {
      const mealPlan: any = { id: 'mp1', date: '2026-03-10', mealType: 'breakfast', recipeId: 'r1', servings: 2, notes: '', completed: false };
      await setup({ mealPlan });
      component.form.patchValue({ servings: 4, completed: true });

      component.onSave();

      expect(mealPlanSpy.updateMeal).toHaveBeenCalledWith('mp1', expect.objectContaining({ servings: 4, completed: true }));
      expect(dataEventsSpy.emit).toHaveBeenCalledWith('meal_plans', 'update');
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('shows a failure snackbar when saving throws', async () => {
      await setup({});
      component.form.patchValue({ recipeId: 'r1' });
      mealPlanSpy.addMeal.mockImplementation(() => { throw new Error('db error'); });

      component.onSave();

      expect(snackbarSpy.error).toHaveBeenCalledWith('mealPlan.failedSave');
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with false', async () => {
      await setup({});
      component.onCancel();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
    });
  });
});
