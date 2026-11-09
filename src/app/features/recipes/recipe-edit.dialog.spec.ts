import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoService } from '@jsverse/transloco';
import { RecipeEditDialog } from './recipe-edit.dialog';
import { DbService } from '../../core/services/db.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { DataEventsService } from '../../core/services/data-events.service';

describe('RecipeEditDialog', () => {
  let fixture: ComponentFixture<RecipeEditDialog>;
  let component: RecipeEditDialog;
  let dbSpy: {
    getAvailableIngredients: ReturnType<typeof vi.fn>;
    getRecipe: ReturnType<typeof vi.fn>;
    getRecipeIngredients: ReturnType<typeof vi.fn>;
    getCurrentUserId: ReturnType<typeof vi.fn>;
    createRecipe: ReturnType<typeof vi.fn>;
    updateRecipeDetails: ReturnType<typeof vi.fn>;
    clearRecipeIngredients: ReturnType<typeof vi.fn>;
    addRecipeIngredient: ReturnType<typeof vi.fn>;
  };
  let snackbarSpy: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let dataEventsSpy: { emit: ReturnType<typeof vi.fn> };

  async function setup(data: any = null) {
    dbSpy = {
      getAvailableIngredients: vi.fn().mockReturnValue([{ id: 'ing-1', name: 'Flour', category: 'Baking' }]),
      getRecipe: vi.fn(),
      getRecipeIngredients: vi.fn().mockReturnValue([]),
      getCurrentUserId: vi.fn().mockReturnValue('u1'),
      createRecipe: vi.fn(),
      updateRecipeDetails: vi.fn(),
      clearRecipeIngredients: vi.fn(),
      addRecipeIngredient: vi.fn(),
    };
    snackbarSpy = { success: vi.fn(), error: vi.fn() };
    dialogRefSpy = { close: vi.fn() };
    dataEventsSpy = { emit: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RecipeEditDialog, MatIconTestingModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: DbService, useValue: dbSpy },
        { provide: SnackbarService, useValue: snackbarSpy },
        { provide: DataEventsService, useValue: dataEventsSpy },
        { provide: TranslocoService, useValue: { translate: vi.fn((key: string) => key) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeEditDialog);
    component = fixture.componentInstance;
    component.ngOnInit();
  }

  it('starts in create mode with an empty form for new recipes', async () => {
    await setup(null);
    expect(component.isEditMode()).toBe(false);
    expect(component.recipeForm.value.name).toBe('');
    expect(component.ingredients.length).toBe(0);
    expect(component.steps.length).toBe(0);
  });

  it('loads the available ingredient list, defaulting a missing category', async () => {
    const dataWithoutCategory = [{ id: 'ing-1', name: 'Flour', category: null }];
    await setup(null);
    dbSpy.getAvailableIngredients.mockReturnValue(dataWithoutCategory);
    component.ngOnInit();

    expect(component.availableIngredients()).toEqual([{ id: 'ing-1', name: 'Flour', category: 'Other' }]);
  });

  it('loads an existing recipe, its steps, and its ingredients in edit mode', async () => {
    await setup({ id: 'rec-1' });
    dbSpy.getRecipe.mockReturnValue({
      id: 'rec-1', name: 'Pancakes', steps: JSON.stringify(['Mix', 'Cook']),
      servings: 2, prepTime: 5, cookTime: 10, imageUrl: 'img.png', notes: 'tasty',
    });
    dbSpy.getRecipeIngredients.mockReturnValue([{ ingredientId: 'ing-1', quantity: 2, unit: 'cup' }]);
    component.ngOnInit();

    expect(component.steps.length).toBe(2);
    expect(component.ingredients.length).toBe(1);
    expect(component.recipeForm.value.name).toBe('Pancakes');
    expect(component.recipeForm.value.notes).toBe('tasty');
  });

  it('does nothing when editing a recipe that no longer exists', async () => {
    await setup({ id: 'missing' });
    dbSpy.getRecipe.mockReturnValue(undefined);

    expect(() => component.ngOnInit()).not.toThrow();
    expect(component.steps.length).toBe(0);
  });

  describe('ingredient and step rows', () => {
    beforeEach(async () => {
      await setup(null);
    });

    it('adds an ingredient row with defaults', () => {
      component.addIngredient();
      expect(component.ingredients.length).toBe(1);
      expect(component.ingredients.at(0).value).toEqual({ ingredientId: null, quantity: 1, unit: 'g' });
    });

    it('removes an ingredient row by index', () => {
      component.addIngredient('ing-1', 2, 'cup');
      component.addIngredient('ing-2', 1, 'g');
      component.removeIngredient(0);
      expect(component.ingredients.length).toBe(1);
      expect(component.ingredients.at(0).value.ingredientId).toBe('ing-2');
    });

    it('adds and removes a step', () => {
      component.addStep('Preheat oven');
      expect(component.steps.length).toBe(1);
      component.removeStep(0);
      expect(component.steps.length).toBe(0);
    });
  });

  describe('save', () => {
    it('refuses to save an invalid form', async () => {
      await setup(null);
      component.recipeForm.patchValue({ name: '' });

      await component.save();

      expect(snackbarSpy.error).toHaveBeenCalledWith('recipes.fillRequiredFields');
      expect(dbSpy.createRecipe).not.toHaveBeenCalled();
    });

    it('creates a new recipe and its ingredient rows, then closes with the new id', async () => {
      await setup(null);
      component.recipeForm.patchValue({ name: 'Pancakes' });
      component.addStep('Mix');
      component.addIngredient('ing-1', 2, 'cup');

      await component.save();

      expect(dbSpy.createRecipe).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Pancakes', steps: JSON.stringify(['Mix']), userId: 'u1',
      }));
      expect(dbSpy.addRecipeIngredient).toHaveBeenCalledWith(expect.objectContaining({
        ingredientId: 'ing-1', quantity: 2, unit: 'cup', userId: 'u1',
      }));
      expect(dbSpy.updateRecipeDetails).not.toHaveBeenCalled();
      expect(dataEventsSpy.emit).toHaveBeenCalledWith('recipes', 'create', expect.any(String));
      expect(dataEventsSpy.emit).toHaveBeenCalledWith('recipe_ingredients', 'create');
      expect(snackbarSpy.success).toHaveBeenCalledWith('recipes.recipeCreated');
      expect(dialogRefSpy.close).toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });

    it('updates an existing recipe and soft-deletes its old ingredient rows', async () => {
      await setup({ id: 'rec-1' });
      dbSpy.getRecipe.mockReturnValue({ id: 'rec-1', name: 'Pancakes', steps: '[]', servings: 2 });
      component.ngOnInit();
      component.recipeForm.patchValue({ name: 'Pancakes v2' });

      await component.save();

      expect(dbSpy.updateRecipeDetails).toHaveBeenCalledWith('rec-1', expect.objectContaining({ name: 'Pancakes v2' }));
      expect(dbSpy.clearRecipeIngredients).toHaveBeenCalledWith('rec-1', expect.any(String));
      expect(dbSpy.createRecipe).not.toHaveBeenCalled();
      expect(dataEventsSpy.emit).toHaveBeenCalledWith('recipes', 'update', 'rec-1');
      expect(snackbarSpy.success).toHaveBeenCalledWith('recipes.recipeUpdated');
      expect(dialogRefSpy.close).toHaveBeenCalledWith('rec-1');
    });

    it('refuses to save when no user is authenticated', async () => {
      await setup(null);
      dbSpy.getCurrentUserId.mockReturnValue(null);
      component.recipeForm.patchValue({ name: 'Pancakes' });

      await component.save();

      expect(snackbarSpy.error).toHaveBeenCalledWith('recipes.failedSave');
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });

    it('shows a failure snackbar and clears saving when the database throws', async () => {
      await setup(null);
      component.recipeForm.patchValue({ name: 'Pancakes' });
      dbSpy.createRecipe.mockImplementation(() => { throw new Error('db error'); });

      await component.save();

      expect(snackbarSpy.error).toHaveBeenCalledWith('recipes.failedSave');
      expect(component.saving()).toBe(false);
    });
  });

  describe('close', () => {
    it('closes the dialog with null', async () => {
      await setup(null);
      component.close();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(null);
    });
  });
});
