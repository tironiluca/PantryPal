import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { DB_TABLE_COLUMNS, DbService } from './db.service';
import { SnackbarService } from './snackbar.service';

const storage = vi.hoisted(() => new Map<string, Uint8Array>());
const openDbMock = vi.hoisted(() => vi.fn(async () => ({
  get: vi.fn(async (_store: string, key: string) => storage.get(key)),
  put: vi.fn(async (_store: string, value: Uint8Array, key: string) => {
    storage.set(key, value);
  }),
  close: vi.fn(),
})));

vi.mock('idb', () => ({ openDB: openDbMock }));

describe('DbService SQL identifier validation', () => {
  let service: DbService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DbService,
        {
          provide: AuthService,
          useValue: { getCurrentUserId: () => null },
        },
      ],
    });
    service = TestBed.inject(DbService);
  });

  it('rejects an unknown table before building a user query', () => {
    expect(() => service.queryByUser('inventory; DROP TABLE users')).toThrow(/Invalid database table/);
  });

  it('rejects unknown or duplicate bulk-insert columns', () => {
    expect(() => service.bulkInsert('inventory', [], ['name; DROP TABLE users'])).toThrow(/Invalid database column/);
    expect(() => service.bulkInsert('inventory', [], ['barcode', 'barcode'])).toThrow(/Invalid database columns/);
  });

  it('rejects an unsafe bulk-update identifier', () => {
    expect(() => service.bulkUpdate('inventory', [], ['quantity'], 'id OR 1=1')).toThrow(/Invalid database column/);
  });

  it('keeps the shared allowlist limited to known schema tables', () => {
    expect(DB_TABLE_COLUMNS.inventory).toContain('barcode');
    expect(DB_TABLE_COLUMNS['users']).toBeUndefined();
  });

  it('loads an ingredient name and its inventory through one service method', () => {
    const queryByUser = vi.spyOn(service, 'queryByUser')
      .mockReturnValueOnce([{ name: 'Milk' }])
      .mockReturnValueOnce([{ quantity: 2, unit: 'l', expiry: '2026-09-01' }]);

    expect(service.getIngredientInventory('ingredient-1')).toEqual({
      name: 'Milk',
      inventory: [{ quantity: 2, unit: 'l', expiry: '2026-09-01' }],
    });
    expect(queryByUser).toHaveBeenNthCalledWith(1, 'ingredients', 'id = ?', ['ingredient-1']);
    expect(queryByUser).toHaveBeenNthCalledWith(2, 'inventory', 'ingredientId = ?', ['ingredient-1']);
  });

  it('loads recipe ingredients and names through user-scoped queries', () => {
    const queryByUser = vi.spyOn(service, 'queryByUser')
      .mockReturnValueOnce([{ id: 'ingredient-1', name: 'Milk' }])
      .mockReturnValueOnce([{ ingredientId: 'ingredient-1', quantity: 2, unit: 'l' }]);

    expect(service.getRecipeIngredients('recipe-1')).toEqual([
      { ingredientId: 'ingredient-1', quantity: 2, unit: 'l', name: 'Milk' },
    ]);
    expect(queryByUser).toHaveBeenNthCalledWith(1, 'ingredients');
    expect(queryByUser).toHaveBeenNthCalledWith(2, 'recipe_ingredients', 'recipeId = ?', ['recipe-1']);
  });

  it('loads only positive inventory through a user-scoped query', () => {
    const queryByUser = vi.spyOn(service, 'queryByUser').mockReturnValue([
      { id: 'inventory-1', quantity: 2, unit: 'l' },
    ]);

    expect(service.getInventoryForIngredient('ingredient-1')).toEqual([
      { id: 'inventory-1', quantity: 2, unit: 'l' },
    ]);
    expect(queryByUser).toHaveBeenCalledWith(
      'inventory',
      'ingredientId = ? AND quantity > 0',
      ['ingredient-1']
    );
  });

  it('loads selected ingredient names through a user-scoped query', () => {
    const queryByUser = vi.spyOn(service, 'queryByUser').mockReturnValue([
      { id: 'ingredient-1', name: 'Milk' },
    ]);

    expect(service.getIngredientsByIds(['ingredient-1', 'ingredient-2'])).toEqual([
      { id: 'ingredient-1', name: 'Milk' },
    ]);
    expect(queryByUser).toHaveBeenCalledWith(
      'ingredients',
      'id IN (?,?)',
      ['ingredient-1', 'ingredient-2']
    );
  });

  it('does not query when no ingredient names are requested', () => {
    const queryByUser = vi.spyOn(service, 'queryByUser');

    expect(service.getIngredientsByIds([])).toEqual([]);
    expect(queryByUser).not.toHaveBeenCalled();
  });

  it('loads categories and available ingredients in display order', () => {
    vi.spyOn(service, 'queryByUser')
      .mockReturnValueOnce([
        { id: 'cat-2', name: 'Vegetables' },
        { id: 'cat-1', name: 'Dairy' },
      ])
      .mockReturnValueOnce([
        { id: 'ing-2', name: 'Zucchini', categoryId: 'cat-2' },
        { id: 'ing-1', name: 'Milk', categoryId: 'cat-1' },
      ]);

    expect(service.getAvailableIngredients()).toEqual([
      { id: 'ing-1', name: 'Milk', category: 'Dairy' },
      { id: 'ing-2', name: 'Zucchini', category: 'Vegetables' },
    ]);
  });

  it('loads a user-scoped recipe and counts active recipe ingredients', () => {
    vi.spyOn(service, 'queryByUser').mockReturnValue([
      { id: 'recipe-1', name: 'Soup', imageUrl: '', servings: 2 },
    ]);
    vi.spyOn(service, 'getRecipeIngredients').mockReturnValue([
      { ingredientId: 'ing-1', quantity: 1, unit: 'pcs', name: 'Carrot' },
    ]);

    expect(service.getRecipesWithIngredientCounts()).toEqual([
      { id: 'recipe-1', name: 'Soup', imageUrl: '', servings: 2, ingredientCount: 1 },
    ]);
  });

  it('loads a recipe through the user-scoped contract', () => {
    const queryByUser = vi.spyOn(service, 'queryByUser').mockReturnValue([
      { id: 'recipe-1', name: 'Soup' },
    ]);

    expect(service.getRecipe('recipe-1')).toEqual({ id: 'recipe-1', name: 'Soup' });
    expect(queryByUser).toHaveBeenCalledWith('recipes', 'id = ?', ['recipe-1']);
  });
});

describe('DbService persistence fallback', () => {
  let service: DbService;
  let snackbar: { warning: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    storage.clear();
    openDbMock.mockClear();
    snackbar = { warning: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        DbService,
        {
          provide: AuthService,
          useValue: { getCurrentUserId: () => null },
        },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    service = TestBed.inject(DbService);
  });

  it('reads and writes the database through IndexedDB when OPFS is unavailable', async () => {
    const db = service as any;
    db.db = { export: () => new Uint8Array([1, 2, 3]) };

    await db.writeToOPFS('pantrypal.db', new Uint8Array([4, 5]));
    expect(storage.get('pantrypal.db')).toEqual(new Uint8Array([4, 5]));

    await expect(db.readFromOPFS('pantrypal.db')).resolves.toEqual(new Uint8Array([4, 5]));
    expect(service.persistenceAvailable()).toBe(true);
  });

  it('marks persistence unavailable and warns once when both backends fail', async () => {
    openDbMock.mockRejectedValue(new Error('IndexedDB unavailable'));
    const db = service as any;
    db.db = { export: () => new Uint8Array([1, 2, 3]) };

    await service.persist();
    await service.persist();

    expect(service.persistenceAvailable()).toBe(false);
    expect(snackbar.warning).toHaveBeenCalledTimes(1);
  });
});