import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { RecipeListComponent } from './recipe-list.component';
import { DbService } from '../../core/services/db.service';
import { DietAdviceService } from '../../core/services/diet-advice.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { DataEventsService } from '../../core/services/data-events.service';
import { KeyboardService } from '../../core/services/keyboard.service';

describe('RecipeListComponent', () => {
  let fixture: ComponentFixture<RecipeListComponent>;
  let component: RecipeListComponent;
  let dbSpy: { getCurrentUserId: ReturnType<typeof vi.fn>; getRecipesWithIngredientCounts: ReturnType<typeof vi.fn>; exec: ReturnType<typeof vi.fn> };
  let dietAdviceSpy: { getIngredientAvailability: ReturnType<typeof vi.fn> };
  let dialogSpy: { open: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handle: ReturnType<typeof vi.fn> };
  let snackbarSpy: { success: ReturnType<typeof vi.fn> };
  let dataEventsSpy: { on: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [
        RecipeListComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: DbService, useValue: dbSpy },
        { provide: DietAdviceService, useValue: dietAdviceSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: ErrorHandlerService, useValue: errorHandlerSpy },
        { provide: SnackbarService, useValue: snackbarSpy },
        { provide: DataEventsService, useValue: dataEventsSpy },
        { provide: KeyboardService, useValue: { addNew$: of(), focusSearch$: of(), escape$: of() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeListComponent);
    component = fixture.componentInstance;
    // MatDialogModule (imported by the component) re-provides the real MatDialog,
    // which shadows the TestBed-level override, so replace it directly on the instance.
    (component as any).dialog = dialogSpy;
  }

  beforeEach(() => {
    dbSpy = {
      getCurrentUserId: vi.fn().mockReturnValue('u1'),
      getRecipesWithIngredientCounts: vi.fn().mockReturnValue([
        { id: 'r1', name: 'Pancakes', ingredientCount: 3 },
        { id: 'r2', name: 'Omelette', ingredientCount: 2 },
      ]),
      exec: vi.fn(),
    };
    dietAdviceSpy = { getIngredientAvailability: vi.fn().mockReturnValue(100) };
    dialogSpy = { open: vi.fn() };
    errorHandlerSpy = { handle: vi.fn() };
    snackbarSpy = { success: vi.fn() };
    dataEventsSpy = { on: vi.fn().mockReturnValue(of()), emit: vi.fn() };
  });

  it('loads recipes and computes whether each can be cooked', async () => {
    await setup();

    expect(component.rows.length).toBe(2);
    expect(component.filteredRows.length).toBe(2);
    expect(component.canCookMap.get('r1')).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('marks a recipe as not cookable when availability is below 100%', async () => {
    dietAdviceSpy.getIngredientAvailability.mockReturnValue(50);
    await setup();

    expect(component.canCookMap.get('r1')).toBe(false);
  });

  it('skips availability computation for a guest with no user id', async () => {
    dbSpy.getCurrentUserId.mockReturnValue(null);
    await setup();

    expect(dietAdviceSpy.getIngredientAvailability).not.toHaveBeenCalled();
    expect(component.canCookMap.size).toBe(0);
  });

  it('falls back to an empty list and reports the error when loading fails', async () => {
    dbSpy.getRecipesWithIngredientCounts.mockImplementation(() => { throw new Error('db error'); });
    await setup();

    expect(errorHandlerSpy.handle).toHaveBeenCalledWith(expect.any(Error), 'Failed to load recipes');
    expect(component.rows).toEqual([]);
    expect(component.filteredRows).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  describe('applyFilters', () => {
    it('shows every recipe when the search term is blank', async () => {
      await setup();
      component.searchTerm = '';
      component.applyFilters();
      expect(component.filteredRows.length).toBe(2);
    });

    it('filters recipes by a case-insensitive name match', async () => {
      await setup();
      component.searchTerm = 'pan';
      component.applyFilters();
      expect(component.filteredRows).toEqual([{ id: 'r1', name: 'Pancakes', ingredientCount: 3 }]);
    });
  });

  describe('add', () => {
    it('refreshes the list after successfully adding a recipe', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(true) });
      const refreshSpy = vi.spyOn(component, 'refresh');

      component.add();

      expect(dialogSpy.open).toHaveBeenCalledWith(expect.anything(), { data: null });
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('does not refresh when the add dialog is cancelled', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(false) });
      const refreshSpy = vi.spyOn(component, 'refresh');
      refreshSpy.mockClear();

      component.add();

      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe('importRecipe', () => {
    it('refreshes the list when a recipe id comes back', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of('r9') });
      const refreshSpy = vi.spyOn(component, 'refresh');

      component.importRecipe();

      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('edit', () => {
    it('opens the edit dialog with the given recipe and refreshes on success', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(true) });
      const refreshSpy = vi.spyOn(component, 'refresh');
      const recipe = { id: 'r1', name: 'Pancakes' };

      component.edit(recipe);

      expect(dialogSpy.open).toHaveBeenCalledWith(expect.anything(), { data: recipe });
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('does nothing when the confirm dialog is cancelled', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(false) });

      component.remove({ id: 'r1', name: 'Pancakes' });

      expect(dbSpy.exec).not.toHaveBeenCalled();
    });

    it('deletes the recipe and its ingredients, then refreshes', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(true) });
      const refreshSpy = vi.spyOn(component, 'refresh');

      component.remove({ id: 'r1', name: 'Pancakes' });

      expect(dbSpy.exec).toHaveBeenCalledWith('DELETE FROM recipe_ingredients WHERE recipeId = ?', ['r1']);
      expect(dbSpy.exec).toHaveBeenCalledWith('DELETE FROM recipes WHERE id = ?', ['r1']);
      expect(dataEventsSpy.emit).toHaveBeenCalledWith('recipes', 'delete', 'r1');
      expect(snackbarSpy.success).toHaveBeenCalledWith('Recipe deleted successfully');
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('reports an error when deletion fails', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(true) });
      dbSpy.exec.mockImplementation(() => { throw new Error('delete failed'); });

      component.remove({ id: 'r1', name: 'Pancakes' });

      expect(errorHandlerSpy.handle).toHaveBeenCalledWith(expect.any(Error), 'Failed to delete recipe');
    });
  });
});
