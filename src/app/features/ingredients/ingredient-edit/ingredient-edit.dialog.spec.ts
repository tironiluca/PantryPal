import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { IngredientEditDialog } from './ingredient-edit.dialog';
import { DbService } from '../../../core/services/db.service';
import { DataEventsService } from '../../../core/services/data-events.service';
import { NutritionService } from '../../../core/services/nutrition.service';

describe('IngredientEditDialog', () => {
  let fixture: ComponentFixture<IngredientEditDialog>;
  let component: IngredientEditDialog;
  let dbSpy: { exec: ReturnType<typeof vi.fn>; getIngredientCategories: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let matDialogSpy: { open: ReturnType<typeof vi.fn> };
  let dataEventsSpy: { emit: ReturnType<typeof vi.fn> };
  let nutritionSpy: { updateIngredientNutrition: ReturnType<typeof vi.fn> };

  async function setup(data: any = null) {
    dbSpy = { exec: vi.fn(), getIngredientCategories: vi.fn().mockReturnValue([{ id: 'c1', name: 'Dairy' }]) };
    dialogRefSpy = { close: vi.fn() };
    matDialogSpy = { open: vi.fn() };
    dataEventsSpy = { emit: vi.fn() };
    nutritionSpy = { updateIngredientNutrition: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        IngredientEditDialog,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MatDialog, useValue: matDialogSpy },
        { provide: DbService, useValue: dbSpy },
        { provide: DataEventsService, useValue: dataEventsSpy },
        { provide: NutritionService, useValue: nutritionSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IngredientEditDialog);
    component = fixture.componentInstance;
    // MatDialogModule (imported by the component) re-provides the real MatDialog,
    // which shadows the TestBed-level override, so replace it directly on the instance.
    (component as any).dialog = matDialogSpy;
  }

  it('starts with a blank model when creating a new ingredient', async () => {
    await setup(null);
    expect(component.model.id).toBe('');
    expect(component.model.notifyStartDays).toBe(3);
  });

  it('clones the provided ingredient when editing', async () => {
    const existing = { id: 'ing-1', name: 'Milk', categoryId: 'c1' };
    await setup(existing);
    expect(component.model).toEqual(existing);
    expect(component.model).not.toBe(existing);
  });

  it('loads ingredient categories on init', async () => {
    await setup(null);
    component.ngOnInit();
    expect(component.categories).toEqual([{ id: 'c1', name: 'Dairy' }]);
  });

  it('falls back to an empty category list when the lookup throws', async () => {
    await setup(null);
    dbSpy.getIngredientCategories.mockImplementation(() => { throw new Error('db not ready'); });
    component.ngOnInit();
    expect(component.categories).toEqual([]);
  });

  describe('hasNutrition', () => {
    it('is false without a positive energy value', async () => {
      await setup(null);
      expect(component.hasNutrition()).toBe(false);
      component.model.energyKcal = 0;
      expect(component.hasNutrition()).toBe(false);
    });

    it('is true once energy is set', async () => {
      await setup(null);
      component.model.energyKcal = 120;
      expect(component.hasNutrition()).toBe(true);
    });
  });

  describe('openNutritionEdit', () => {
    it('assigns a temporary id for a brand-new ingredient before opening the dialog', async () => {
      await setup(null);
      matDialogSpy.open.mockReturnValue({ afterClosed: () => of(null) });

      component.openNutritionEdit();

      expect(component.model.id).toMatch(/^ing-/);
      expect(matDialogSpy.open).toHaveBeenCalled();
    });

    it('stores the returned nutrition data onto the model for saving later', async () => {
      const nutrition = { energyKcal: 100, proteinG: 5, carbsG: 10, fatG: 2, fiberG: 1, sugarG: 1, sodiumMg: 50 };
      await setup({ id: 'ing-1', name: 'Milk' });
      matDialogSpy.open.mockReturnValue({ afterClosed: () => of(nutrition) });

      component.openNutritionEdit();

      expect(component.model.energyKcal).toBe(100);
      expect(component.model.proteinG).toBe(5);
    });

    it('leaves the model untouched when the nutrition dialog is cancelled', async () => {
      await setup({ id: 'ing-1', name: 'Milk', energyKcal: 50 });
      matDialogSpy.open.mockReturnValue({ afterClosed: () => of(null) });

      component.openNutritionEdit();

      expect(component.model.energyKcal).toBe(50);
    });
  });

  describe('save', () => {
    it('inserts a new ingredient and closes with true', async () => {
      await setup(null);
      component.model = { id: '', name: 'Flour', categoryId: 'c1', defaultShelfLifeDays: 30, notifyStartDays: 3, notifyRepeatDays: 1 };

      component.save();

      expect(dbSpy.exec).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ingredients'), expect.any(Array));
      expect(dataEventsSpy.emit).toHaveBeenCalledWith('ingredients', 'create', expect.stringMatching(/^ing-/));
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('updates an existing ingredient', async () => {
      await setup({ id: 'ing-1', name: 'Milk', categoryId: 'c1' });

      component.save();

      expect(dbSpy.exec).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients SET'), expect.any(Array));
      expect(dataEventsSpy.emit).toHaveBeenCalledWith('ingredients', 'update', 'ing-1');
      expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
    });

    it('persists pending nutrition captured from the sub-dialog', async () => {
      const nutrition = { energyKcal: 100, proteinG: 5, carbsG: 10, fatG: 2, fiberG: 1, sugarG: 1, sodiumMg: 50 };
      await setup({ id: 'ing-1', name: 'Milk' });
      matDialogSpy.open.mockReturnValue({ afterClosed: () => of(nutrition) });
      component.openNutritionEdit();

      component.save();

      expect(nutritionSpy.updateIngredientNutrition).toHaveBeenCalledWith('ing-1', nutrition);
    });

    it('does not touch nutrition when none was captured', async () => {
      await setup({ id: 'ing-1', name: 'Milk' });

      component.save();

      expect(nutritionSpy.updateIngredientNutrition).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('closes the dialog with false', async () => {
      await setup(null);
      component.close();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
    });
  });
});
