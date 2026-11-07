import { signal } from '@angular/core';
import { NutritionEditDialog } from './nutrition-edit.dialog';

function bare(): NutritionEditDialog & Record<string, any> {
  const component = Object.create(NutritionEditDialog.prototype) as NutritionEditDialog & Record<string, any>;
  component.searchQuery = 'Milk';
  component.searching = signal(false);
  component.searchResults = signal([]);
  component.noResults = signal(false);
  component.selected = signal(null);
  component.manual = { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 };
  component.nutritionService = { getNutritionByName: vi.fn() };
  component.dialogRef = { close: vi.fn() };
  return component;
}

describe('NutritionEditDialog', () => {
  describe('search', () => {
    it('does nothing for a blank query', async () => {
      const component = bare();
      component.searchQuery = '   ';

      await component.search();

      expect(component.nutritionService.getNutritionByName).not.toHaveBeenCalled();
    });

    it('stores matching results', async () => {
      const component = bare();
      const results = [{ productName: 'Whole Milk', energyKcal: 60, proteinG: 3, carbsG: 5, fatG: 3 }];
      component.nutritionService.getNutritionByName.mockResolvedValue(results);

      await component.search();

      expect(component.searchResults()).toEqual(results);
      expect(component.noResults()).toBe(false);
      expect(component.searching()).toBe(false);
    });

    it('flags no results when the search returns an empty list', async () => {
      const component = bare();
      component.nutritionService.getNutritionByName.mockResolvedValue([]);

      await component.search();

      expect(component.noResults()).toBe(true);
      expect(component.searchResults()).toEqual([]);
    });

    it('flags no results when the search throws', async () => {
      const component = bare();
      component.nutritionService.getNutritionByName.mockRejectedValue(new Error('offline'));

      await component.search();

      expect(component.noResults()).toBe(true);
      expect(component.searching()).toBe(false);
    });
  });

  describe('selectResult', () => {
    it('sets the selected nutrition data and copies it into the manual form', () => {
      const component = bare();

      component.selectResult({
        productName: 'Whole Milk',
        energyKcal: 60,
        proteinG: 3,
        carbsG: 5,
        fatG: 3,
        fiberG: 0,
        sugarG: 5,
        sodiumMg: 40,
      });

      expect(component.selected()).toEqual({
        energyKcal: 60,
        proteinG: 3,
        carbsG: 5,
        fatG: 3,
        fiberG: 0,
        sugarG: 5,
        sodiumMg: 40,
      });
      expect(component.manual).toMatchObject({ energyKcal: 60, proteinG: 3, fatG: 3 });
    });
  });

  describe('saveSelected', () => {
    it('does not close the dialog when nothing is selected', () => {
      const component = bare();

      component.saveSelected();

      expect(component.dialogRef.close).not.toHaveBeenCalled();
    });

    it('closes the dialog with the selected nutrition data', () => {
      const component = bare();
      const data = { energyKcal: 60, proteinG: 3, carbsG: 5, fatG: 3 };
      component.selected.set(data);

      component.saveSelected();

      expect(component.dialogRef.close).toHaveBeenCalledWith(data);
    });
  });

  describe('saveManual', () => {
    it('closes the dialog with a copy of the manual entry', () => {
      const component = bare();
      component.manual.energyKcal = 120;

      component.saveManual();

      expect(component.dialogRef.close).toHaveBeenCalledWith(component.manual);
      expect(component.dialogRef.close.mock.calls[0][0]).not.toBe(component.manual);
    });
  });
});
