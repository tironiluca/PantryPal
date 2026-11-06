import { signal } from '@angular/core';
import { WeeklyShoppingListComponent } from './weekly-shopping-list.component';
import { ShoppingListItem } from '../../core/services/meal-plan.service';

function fakeFormGroup(initial: { startDate: Date | null; endDate: Date | null }) {
  const group: any = {
    value: { ...initial },
    patchValue(update: Partial<typeof initial>) {
      Object.assign(group.value, update);
    },
  };
  return group;
}

function bare(): WeeklyShoppingListComponent & Record<string, any> {
  const component = Object.create(
    WeeklyShoppingListComponent.prototype
  ) as WeeklyShoppingListComponent & Record<string, any>;
  component.shoppingList = signal<ShoppingListItem[]>([]);
  component.checkedItemIds = signal<Set<string>>(new Set());
  component.snackbar = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  component.mealPlanService = { getShoppingListForPeriod: vi.fn(() => []) };
  component.exportService = { exportToPdf: vi.fn(), exportToCsv: vi.fn(), printShoppingList: vi.fn() };
  component.dateForm = fakeFormGroup({
    startDate: new Date(2026, 5, 1),
    endDate: new Date(2026, 5, 7),
  });
  return component;
}

function item(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return {
    ingredientId: 'milk',
    ingredientName: 'Milk',
    totalQuantity: 2,
    unit: 'L',
    inventoryQuantity: 0,
    needed: 2,
    mealPlans: ['Pancakes'],
    ...overrides,
  };
}

describe('WeeklyShoppingListComponent', () => {
  describe('loadShoppingList', () => {
    it('does nothing when the form has no date range', () => {
      const component = bare();
      component.dateForm.value.startDate = null;

      component.loadShoppingList();

      expect(component.mealPlanService.getShoppingListForPeriod).not.toHaveBeenCalled();
    });

    it('queries the formatted date range and stores the result', () => {
      const component = bare();
      const list = [item()];
      component.mealPlanService.getShoppingListForPeriod.mockReturnValue(list);

      component.loadShoppingList();

      expect(component.mealPlanService.getShoppingListForPeriod).toHaveBeenCalledWith(
        '2026-06-01',
        '2026-06-07'
      );
      expect(component.shoppingList()).toBe(list);
    });
  });

  it('onDateChange reloads the shopping list', () => {
    const component = bare();
    component.loadShoppingList = vi.fn();

    component.onDateChange();

    expect(component.loadShoppingList).toHaveBeenCalled();
  });

  describe('date range shortcuts', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date('2026-06-10T00:00:00')); // a Wednesday
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('selectThisWeek sets Sunday through Saturday of the current week', () => {
      const component = bare();
      component.loadShoppingList = vi.fn();

      component.selectThisWeek();

      expect(component.dateForm.value.startDate).toEqual(new Date(2026, 5, 7));
      expect(component.dateForm.value.endDate).toEqual(new Date(2026, 5, 13));
      expect(component.loadShoppingList).toHaveBeenCalled();
    });

    it('selectNextWeek sets the following Sunday through Saturday', () => {
      const component = bare();
      component.loadShoppingList = vi.fn();

      component.selectNextWeek();

      expect(component.dateForm.value.startDate).toEqual(new Date(2026, 5, 14));
      expect(component.dateForm.value.endDate).toEqual(new Date(2026, 5, 20));
    });

    it('selectThisMonth sets the first and last day of the current month', () => {
      const component = bare();
      component.loadShoppingList = vi.fn();

      component.selectThisMonth();

      expect(component.dateForm.value.startDate).toEqual(new Date(2026, 5, 1));
      expect(component.dateForm.value.endDate).toEqual(new Date(2026, 5, 30));
    });
  });

  describe('checked items', () => {
    it('toggles an ingredient id in and out of the checked set', () => {
      const component = bare();

      component.toggleCheck('milk');
      expect(component.isChecked('milk')).toBe(true);

      component.toggleCheck('milk');
      expect(component.isChecked('milk')).toBe(false);
    });

    it('clears all checked items and notifies', () => {
      const component = bare();
      component.checkedItemIds.set(new Set(['milk', 'eggs']));

      component.clearChecked();

      expect(component.checkedItemIds().size).toBe(0);
      expect(component.snackbar.success).toHaveBeenCalledWith('Cleared all checked items');
    });
  });

  describe('exporting', () => {
    it('warns instead of exporting to PDF when the list is empty', () => {
      const component = bare();

      component.exportToPdf();

      expect(component.exportService.exportToPdf).not.toHaveBeenCalled();
      expect(component.snackbar.warning).toHaveBeenCalledWith('No items to export');
    });

    it('exports to PDF with a titled date range', () => {
      const component = bare();
      component.shoppingList.set([item()]);

      component.exportToPdf();

      expect(component.exportService.exportToPdf).toHaveBeenCalledWith(
        [item()],
        expect.objectContaining({ title: 'Shopping List - 2026-06-01 to 2026-06-07' })
      );
      expect(component.snackbar.success).toHaveBeenCalledWith('PDF downloaded successfully!');
    });

    it('warns instead of exporting to CSV when the list is empty', () => {
      const component = bare();

      component.exportToCsv();

      expect(component.exportService.exportToCsv).not.toHaveBeenCalled();
    });

    it('exports to CSV with a titled date range', () => {
      const component = bare();
      component.shoppingList.set([item()]);

      component.exportToCsv();

      expect(component.exportService.exportToCsv).toHaveBeenCalled();
      expect(component.snackbar.success).toHaveBeenCalledWith('CSV downloaded successfully!');
    });

    it('warns instead of printing when the list is empty', () => {
      const component = bare();

      component.print();

      expect(component.exportService.printShoppingList).not.toHaveBeenCalled();
      expect(component.snackbar.warning).toHaveBeenCalledWith('No items to print');
    });

    it('prints the shopping list', () => {
      const component = bare();
      component.shoppingList.set([item()]);

      component.print();

      expect(component.exportService.printShoppingList).toHaveBeenCalled();
    });
  });

  describe('copyToClipboard', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('warns instead of copying when the list is empty', () => {
      const component = bare();

      component.copyToClipboard();

      expect(component.snackbar.warning).toHaveBeenCalledWith('No items to copy');
    });

    it('copies only the items still needed and reports success', async () => {
      const component = bare();
      component.shoppingList.set([
        item({ ingredientName: 'Milk', needed: 2, unit: 'L' }),
        item({ ingredientName: 'Salt', needed: 0, unit: 'g' }),
      ]);
      const writeText = vi.fn(() => Promise.resolve());
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      component.copyToClipboard();
      await Promise.resolve();
      await Promise.resolve();

      expect(writeText).toHaveBeenCalledWith('☐ Milk - 2.00 L');
      expect(component.snackbar.success).toHaveBeenCalledWith('Shopping list copied to clipboard!');
    });

    it('reports an error when the clipboard write fails', async () => {
      const component = bare();
      component.shoppingList.set([item()]);
      const writeText = vi.fn(() => Promise.reject(new Error('denied')));
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      component.copyToClipboard();
      await Promise.resolve();
      await Promise.resolve();

      expect(component.snackbar.error).toHaveBeenCalledWith('Failed to copy to clipboard');
    });
  });

  it('formatQuantity renders a fixed two-decimal quantity with its unit', () => {
    const component = bare();
    expect(component.formatQuantity(1, 'L')).toBe('1.00 L');
  });
});
