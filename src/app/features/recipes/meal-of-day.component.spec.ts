import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { MealOfDayComponent } from './meal-of-day.component';
import { DbService } from '../../core/services/db.service';
import { UnitConverterService } from '../../core/services/unit-converter.service';

interface RecipeIngredient { ingredientId: string; quantity: number; unit: string }

function makeDb(opts: {
  recipes: any[];
  ingredientsByRecipe: Record<string, RecipeIngredient[]>;
  inventoryByIngredient: Record<string, { name: string | null; inventory: Array<{ quantity: number; unit: string; expiry?: string | null }> }>;
}) {
  return {
    queryByUser: vi.fn(() => opts.recipes),
    getRecipeIngredients: vi.fn((recipeId: string) => opts.ingredientsByRecipe[recipeId] ?? []),
    getIngredientInventory: vi.fn((ingredientId: string) => opts.inventoryByIngredient[ingredientId] ?? { name: null, inventory: [] }),
  };
}

describe('MealOfDayComponent', () => {
  let fixture: ComponentFixture<MealOfDayComponent>;
  let component: MealOfDayComponent;
  let dbSpy: ReturnType<typeof makeDb>;
  let unitConverterSpy: { sumQuantities: ReturnType<typeof vi.fn> };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [MealOfDayComponent, MatIconTestingModule],
      providers: [
        { provide: DbService, useValue: dbSpy },
        { provide: UnitConverterService, useValue: unitConverterSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MealOfDayComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    localStorage.clear();
  });

  it('leaves no recipe selected when the user has no recipes', async () => {
    dbSpy = makeDb({ recipes: [], ingredientsByRecipe: {}, inventoryByIngredient: {} });
    unitConverterSpy = { sumQuantities: vi.fn().mockReturnValue(0) };
    await setup();

    expect(component.recipe).toBeNull();
  });

  it('selects the recipe with every ingredient fully in stock', async () => {
    dbSpy = makeDb({
      recipes: [{ id: 'r1', name: 'Pancakes' }],
      ingredientsByRecipe: { r1: [{ ingredientId: 'flour', quantity: 2, unit: 'cup' }] },
      inventoryByIngredient: { flour: { name: 'Flour', inventory: [{ quantity: 3, unit: 'cup' }] } },
    });
    unitConverterSpy = { sumQuantities: vi.fn().mockReturnValue(3) };
    await setup();

    expect(component.recipe).toEqual({ id: 'r1', name: 'Pancakes' });
    expect(component.missing).toEqual([]);
    expect(component.availableCount).toBe(1);
    expect(component.totalCount).toBe(1);
    expect(component.score).toBe(67);
    expect(localStorage.getItem('recipe-suggested-r1')).toBeTruthy();
  });

  it('lists an ingredient as missing when none is available', async () => {
    dbSpy = makeDb({
      recipes: [{ id: 'r1', name: 'Pancakes' }],
      ingredientsByRecipe: { r1: [{ ingredientId: 'flour', quantity: 2, unit: 'cup' }] },
      inventoryByIngredient: { flour: { name: 'Flour', inventory: [] } },
    });
    unitConverterSpy = { sumQuantities: vi.fn().mockReturnValue(0) };
    await setup();

    expect(component.missing).toEqual(['Flour']);
    expect(component.availableCount).toBe(0);
    expect(component.score).toBe(0);
  });

  it('falls back to the ingredient id when its name is unknown', async () => {
    dbSpy = makeDb({
      recipes: [{ id: 'r1', name: 'Pancakes' }],
      ingredientsByRecipe: { r1: [{ ingredientId: 'flour', quantity: 2, unit: 'cup' }] },
      inventoryByIngredient: { flour: { name: null, inventory: [] } },
    });
    unitConverterSpy = { sumQuantities: vi.fn().mockReturnValue(0) };
    await setup();

    expect(component.missing).toEqual(['flour']);
  });

  it('picks the higher-scoring recipe when more than one is available', async () => {
    dbSpy = makeDb({
      recipes: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }],
      ingredientsByRecipe: {
        low: [{ ingredientId: 'x', quantity: 2, unit: 'cup' }],
        high: [{ ingredientId: 'y', quantity: 2, unit: 'cup' }],
      },
      inventoryByIngredient: {
        x: { name: 'X', inventory: [] },
        y: { name: 'Y', inventory: [{ quantity: 5, unit: 'cup' }] },
      },
    });
    unitConverterSpy = { sumQuantities: vi.fn((items: any) => (items[0]?.quantity ?? 0)) };
    await setup();

    expect(component.recipe.id).toBe('high');
  });

  it('awards a bonus and tracks expiring ingredients used within a week', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    const soonStr = soon.toISOString().split('T')[0];

    dbSpy = makeDb({
      recipes: [{ id: 'r1', name: 'Soup' }],
      ingredientsByRecipe: { r1: [{ ingredientId: 'carrot', quantity: 1, unit: 'unit' }] },
      inventoryByIngredient: { carrot: { name: 'Carrot', inventory: [{ quantity: 2, unit: 'unit', expiry: soonStr }] } },
    });
    unitConverterSpy = { sumQuantities: vi.fn().mockReturnValue(2) };
    await setup();

    expect(component.score).toBeGreaterThan(67);
    expect(component.expiringIngredients).toEqual(['carrot']);
  });

  it('clamps the score to zero when a recently-suggested penalty would make it negative', async () => {
    localStorage.setItem('recipe-suggested-r1', String(Date.now()));
    dbSpy = makeDb({
      recipes: [{ id: 'r1', name: 'Pancakes' }],
      ingredientsByRecipe: { r1: [{ ingredientId: 'flour', quantity: 2, unit: 'cup' }] },
      inventoryByIngredient: { flour: { name: 'Flour', inventory: [{ quantity: 3, unit: 'cup' }] } },
    });
    unitConverterSpy = { sumQuantities: vi.fn().mockReturnValue(3) };
    await setup();

    expect(component.score).toBe(0);
  });

  describe('refreshSuggestion', () => {
    it('excludes the current recipe and selects a different one', async () => {
      dbSpy = makeDb({
        recipes: [{ id: 'r1', name: 'A' }, { id: 'r2', name: 'B' }],
        ingredientsByRecipe: { r1: [], r2: [] },
        inventoryByIngredient: {},
      });
      unitConverterSpy = { sumQuantities: vi.fn().mockReturnValue(0) };
      await setup();
      const first = component.recipe.id;

      component.refreshSuggestion();

      expect(component.recipe.id).not.toBe(first);
    });

    it('resets exclusions and retries once every recipe has been excluded', async () => {
      dbSpy = makeDb({
        recipes: [{ id: 'r1', name: 'Only' }],
        ingredientsByRecipe: { r1: [] },
        inventoryByIngredient: {},
      });
      unitConverterSpy = { sumQuantities: vi.fn().mockReturnValue(0) };
      await setup();

      component.refreshSuggestion();

      expect(component.recipe.id).toBe('r1');
    });
  });
});
