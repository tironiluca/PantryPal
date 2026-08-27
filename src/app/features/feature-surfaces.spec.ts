import { InventoryListComponent } from './inventory/inventory-list.component';
import { IngredientListComponent } from './ingredients/ingredient-list.component';
import { RecipeListComponent } from './recipes/recipe-list.component';
import { DietAdviceComponent } from './nutrition/diet-advice.component';
import { NutritionDashboardComponent } from './nutrition/nutrition-dashboard.component';
import { NutritionReportsComponent } from './nutrition/nutrition-reports.component';
import { VoiceControlOverlayComponent } from './voice/voice-control-overlay.component';

function bare<T>(type: new (...args: any[]) => T): T {
  return Object.create(type.prototype) as T;
}

describe('feature component behavior', () => {
  it('filters inventory by ingredient name and barcode', () => {
    const component = bare(InventoryListComponent) as any;
    component.rows = [
      { id: '1', ingredientId: 'milk', quantity: 1, minRestock: 2, barcode: '123' },
      { id: '2', ingredientId: 'bread', quantity: 3, minRestock: 1, barcode: '456' },
    ];
    component.filteredRows = [];
    component.ingredientNames = new Map([['milk', 'Milk'], ['bread', 'Bread']]);
    component.searchTerm = '123';
    component.locationFilter = null;
    component.expiringFilter = 'all';
    component.applyFilters();
    expect(component.filteredRows.map((row: any) => row.id)).toEqual(['1']);
    expect(component.getLocationIcon('freezer')).toBe('ac_unit');
    expect(component.isLowStock(component.rows[0])).toBe(true);
  });

  it('filters ingredients using the resolved category name', () => {
    const component = bare(IngredientListComponent) as any;
    component.rows = [
      { id: '1', name: 'Milk', categoryId: 'dairy' },
      { id: '2', name: 'Carrot', categoryId: 'veg' },
    ];
    component.filteredRows = [];
    component.categoryNames = new Map([['dairy', 'Dairy'], ['veg', 'Vegetables']]);
    component.searchTerm = 'dairy';
    component.sortColumn = 'name';
    component.sortDirection = 'asc';
    component.applyFilters();
    expect(component.filteredRows.map((row: any) => row.id)).toEqual(['1']);
  });

  it('filters recipes by name', () => {
    const component = bare(RecipeListComponent) as any;
    component.rows = [{ id: '1', name: 'Soup' }, { id: '2', name: 'Salad' }];
    component.searchTerm = 'soup';
    component.applyFilters();
    expect(component.filteredRows).toEqual([{ id: '1', name: 'Soup' }]);
  });

  it('maps nutrition progress to Material color states', () => {
    const component = bare(NutritionDashboardComponent) as any;
    expect(component.getProgressColor(40)).toBe('warn');
    expect(component.getProgressColor(80)).toBe('accent');
    expect(component.getProgressColor(100)).toBe('primary');
    component.summary = () => ({ totalKcal: 100 });
    expect(component.getCaloriePercent(10, 4)).toBe(40);
  });

  it('calculates nutrition report bar heights and periods', () => {
    const component = bare(NutritionReportsComponent) as any;
    expect(component.getBarHeight(500, {
      avgKcal: 1000,
      dailySummaries: [{ totalKcal: 1000 }, { totalKcal: 500 }],
    } as any)).toBe(50);
  });

  it('maps diet advice scores to presentation classes', () => {
    const component = bare(DietAdviceComponent) as any;
    expect(component.getFitClass(90)).toBe('fit-high');
    expect(component.getFitClass(70)).toBe('fit-high');
    expect(component.getFitClass(40)).toBe('fit-mid');
    expect(component.getFitClass(10)).toBe('fit-low');
  });

  it('maps voice actions to stable command icons', () => {
    const component = bare(VoiceControlOverlayComponent) as any;
    expect(component.getCommandIcon('add')).toBe('add_circle');
    expect(component.getCommandIcon('search')).toBe('search');
    expect(component.getCommandIcon('unknown')).toBe('mic');
  });
});
