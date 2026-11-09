import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { RecipeImportDialog } from './recipe-import.dialog';
import { RecipeImportService } from '../../core/services/recipe-import.service';
import { IngredientMatchingService } from '../../core/services/ingredient-matching.service';
import { DbService } from '../../core/services/db.service';
import { SnackbarService } from '../../core/services/snackbar.service';

describe('RecipeImportDialog', () => {
  let fixture: ComponentFixture<RecipeImportDialog>;
  let component: RecipeImportDialog;
  let importServiceSpy: { importFromUrl: ReturnType<typeof vi.fn>; parseIngredientsWithQuantities: ReturnType<typeof vi.fn> };
  let matcherSpy: { mapIngredients: ReturnType<typeof vi.fn>; createIngredientFromImport: ReturnType<typeof vi.fn> };
  let dbSpy: {
    getCurrentUserId: ReturnType<typeof vi.fn>;
    createImportedRecipe: ReturnType<typeof vi.fn>;
    addRecipeIngredient: ReturnType<typeof vi.fn>;
  };
  let snackbarSpy: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    importServiceSpy = { importFromUrl: vi.fn(), parseIngredientsWithQuantities: vi.fn() };
    matcherSpy = { mapIngredients: vi.fn(), createIngredientFromImport: vi.fn() };
    dbSpy = { getCurrentUserId: vi.fn().mockReturnValue('u1'), createImportedRecipe: vi.fn(), addRecipeIngredient: vi.fn() };
    snackbarSpy = { success: vi.fn(), error: vi.fn() };
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RecipeImportDialog, MatIconTestingModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: RecipeImportService, useValue: importServiceSpy },
        { provide: IngredientMatchingService, useValue: matcherSpy },
        { provide: DbService, useValue: dbSpy },
        { provide: SnackbarService, useValue: snackbarSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeImportDialog);
    component = fixture.componentInstance;
  });

  describe('fetchRecipe', () => {
    it('does nothing when the url is invalid', async () => {
      component.urlForm.patchValue({ url: 'not-a-url' });

      await component.fetchRecipe();

      expect(importServiceSpy.importFromUrl).not.toHaveBeenCalled();
    });

    it('fetches, parses, and maps ingredients on success', async () => {
      const recipe = { name: 'Pancakes', ingredients: ['2 cups flour'], instructions: 'Mix', sourceUrl: 'https://example.com' };
      importServiceSpy.importFromUrl.mockResolvedValue(recipe);
      importServiceSpy.parseIngredientsWithQuantities.mockReturnValue([
        { original: '2 cups flour', quantity: 2, unit: 'cup', ingredientName: 'flour' },
      ]);
      matcherSpy.mapIngredients.mockReturnValue([
        { original: 'flour', matches: [], bestMatch: { ingredientId: 'ing-1', score: 90 }, needsReview: false },
      ]);
      component.urlForm.patchValue({ url: 'https://example.com/recipe' });

      await component.fetchRecipe();

      expect(component.importedRecipe()).toEqual(recipe);
      expect(component.ingredientMappings()).toEqual([
        {
          original: { original: '2 cups flour', quantity: 2, unit: 'cup', ingredientName: 'flour' },
          matchResult: { original: 'flour', matches: [], bestMatch: { ingredientId: 'ing-1', score: 90 }, needsReview: false },
          selectedIngredientId: 'ing-1',
          createNew: false,
        },
      ]);
      expect(snackbarSpy.success).toHaveBeenCalledWith('Recipe fetched successfully!');
      expect(component.loading()).toBe(false);
    });

    it('marks an ingredient with no match as needing a new ingredient', async () => {
      importServiceSpy.importFromUrl.mockResolvedValue({ name: 'Pancakes', ingredients: ['mystery item'], instructions: '' });
      importServiceSpy.parseIngredientsWithQuantities.mockReturnValue([
        { original: 'mystery item', quantity: 1, unit: 'unit', ingredientName: 'mystery item' },
      ]);
      matcherSpy.mapIngredients.mockReturnValue([
        { original: 'mystery item', matches: [], bestMatch: null, needsReview: true },
      ]);
      component.urlForm.patchValue({ url: 'https://example.com/recipe' });

      await component.fetchRecipe();

      expect(component.ingredientMappings()[0].createNew).toBe(true);
      expect(component.ingredientMappings()[0].selectedIngredientId).toBeNull();
    });

    it('records the error message and shows a failure snackbar when the fetch rejects', async () => {
      importServiceSpy.importFromUrl.mockRejectedValue(new Error('timed out'));
      component.urlForm.patchValue({ url: 'https://example.com/recipe' });

      await component.fetchRecipe();

      expect(component.error()).toBe('timed out');
      expect(snackbarSpy.error).toHaveBeenCalledWith('Failed to fetch recipe');
      expect(component.loading()).toBe(false);
    });

    it('falls back to a generic error message for a non-Error rejection', async () => {
      importServiceSpy.importFromUrl.mockRejectedValue('weird failure');
      component.urlForm.patchValue({ url: 'https://example.com/recipe' });

      await component.fetchRecipe();

      expect(component.error()).toBe('Failed to fetch recipe');
    });
  });

  describe('saveRecipe', () => {
    it('does nothing when no recipe has been imported', async () => {
      await component.saveRecipe();
      expect(dbSpy.createImportedRecipe).not.toHaveBeenCalled();
    });

    it('refuses to save when no user is authenticated', async () => {
      dbSpy.getCurrentUserId.mockReturnValue(null);
      component.importedRecipe.set({ name: 'Pancakes', ingredients: [], instructions: '' } as any);

      await component.saveRecipe();

      expect(snackbarSpy.error).toHaveBeenCalledWith('Failed to save recipe');
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });

    it('inserts the recipe and maps each ingredient, reusing a matched id', async () => {
      component.importedRecipe.set({
        name: 'Pancakes', ingredients: [], instructions: 'Mix', sourceUrl: 'https://example.com',
      } as any);
      component.ingredientMappings.set([
        {
          original: { original: '2 cups flour', quantity: 2, unit: 'cup', ingredientName: 'flour' },
          matchResult: { original: 'flour', matches: [], bestMatch: null, needsReview: false },
          selectedIngredientId: 'ing-1',
          createNew: false,
        },
      ]);

      await component.saveRecipe();

      expect(dbSpy.createImportedRecipe).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Pancakes', steps: 'Mix', userId: 'u1', sourceUrl: 'https://example.com', sourceName: null,
      }));
      expect(dbSpy.addRecipeIngredient).toHaveBeenCalledWith(expect.objectContaining({
        ingredientId: 'ing-1', quantity: 2, unit: 'cup', userId: 'u1',
      }));
      expect(matcherSpy.createIngredientFromImport).not.toHaveBeenCalled();
      expect(snackbarSpy.success).toHaveBeenCalledWith('Recipe "Pancakes" imported successfully!');
      expect(dialogRefSpy.close).toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });

    it('creates a new ingredient when the mapping has no selected id', async () => {
      matcherSpy.createIngredientFromImport.mockReturnValue('ing-new');
      component.importedRecipe.set({ name: 'Pancakes', ingredients: [], instructions: '' } as any);
      component.ingredientMappings.set([
        {
          original: { original: 'mystery item', quantity: 1, unit: 'unit', ingredientName: 'mystery item' },
          matchResult: { original: 'mystery item', matches: [], bestMatch: null, needsReview: true },
          selectedIngredientId: null,
          createNew: true,
        },
      ]);

      await component.saveRecipe();

      expect(matcherSpy.createIngredientFromImport).toHaveBeenCalledWith('mystery item');
      expect(dbSpy.addRecipeIngredient).toHaveBeenCalledWith(expect.objectContaining({ ingredientId: 'ing-new' }));
    });

    it('shows a failure snackbar when the database throws', async () => {
      component.importedRecipe.set({ name: 'Pancakes', ingredients: [], instructions: '' } as any);
      dbSpy.createImportedRecipe.mockImplementation(() => { throw new Error('db error'); });

      await component.saveRecipe();

      expect(snackbarSpy.error).toHaveBeenCalledWith('Failed to save recipe');
      expect(component.saving()).toBe(false);
    });
  });
});
