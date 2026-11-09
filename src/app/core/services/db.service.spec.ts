import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
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

describe('DbService typed mutation methods', () => {
  let service: DbService;
  let exec: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DbService,
        { provide: AuthService, useValue: { getCurrentUserId: () => null } },
      ],
    });
    service = TestBed.inject(DbService);
    exec = vi.spyOn(service, 'exec').mockImplementation(() => undefined as any);
  });

  it('creates an inventory item with every column in order', () => {
    service.createInventoryItem({
      id: 'inv-1', ingredientId: 'ing-1', quantity: 2, unit: 'kg', minRestock: 1,
      expiry: '2026-05-01', location: 'fridge', barcode: '123', createdAt: 't1', updatedAt: 't1',
    });

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO inventory'),
      ['inv-1', 'ing-1', 2, 'kg', 1, '2026-05-01', 'fridge', '123', 't1', 't1']
    );
  });

  it('updates an inventory item\'s details', () => {
    service.updateInventoryItemDetails('inv-1', {
      ingredientId: 'ing-1', quantity: 3, unit: 'kg', minRestock: 1,
      expiry: null, location: null, barcode: null, updatedAt: 't2',
    });

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inventory SET'),
      ['ing-1', 3, 'kg', 1, null, null, null, 't2', 'inv-1']
    );
  });

  it('sets an inventory item quantity directly', () => {
    service.setInventoryQuantity('inv-1', 0, 't3');

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inventory SET quantity = ?'),
      [0, 't3', 'inv-1']
    );
  });

  it('creates an ingredient', () => {
    service.createIngredient({ id: 'ing-1', name: 'Flour', categoryId: 'cat-1', defaultShelfLifeDays: 30, notifyStartDays: 3, notifyRepeatDays: 1 });

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ingredients'),
      ['ing-1', 'Flour', 'cat-1', 30, 3, 1]
    );
  });

  it('updates an ingredient\'s details', () => {
    service.updateIngredientDetails('ing-1', { name: 'Flour', categoryId: null, defaultShelfLifeDays: null, notifyStartDays: null, notifyRepeatDays: null });

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE ingredients SET'),
      ['Flour', null, null, null, null, 'ing-1']
    );
  });

  it('creates a recipe with a fresh version and not deleted', () => {
    service.createRecipe({
      id: 'rec-1', name: 'Soup', steps: '[]', servings: 2, prepTime: 5, cookTime: 10,
      imageUrl: null, notes: null, userId: 'u1', createdAt: 't1', updatedAt: 't1',
    });

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO recipes'),
      ['rec-1', 'Soup', '[]', 2, 5, 10, null, null, 'u1', 1, 0, 't1', 't1']
    );
  });

  it('creates an imported recipe with source attribution', () => {
    service.createImportedRecipe({
      id: 'rec-1', name: 'Soup', steps: 'Mix', userId: 'u1', sourceUrl: 'https://example.com',
      sourceName: 'Example', importedAt: 't1', imageUrl: null, prepTime: null, cookTime: null,
      servings: null, createdAt: 't1', updatedAt: 't1',
    });

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO recipes'),
      ['rec-1', 'Soup', 'Mix', 'u1', 'https://example.com', 'Example', 't1', null, null, null, null, 1, 0, 't1', 't1']
    );
  });

  it('updates a recipe\'s details and bumps its version', () => {
    service.updateRecipeDetails('rec-1', {
      name: 'Soup v2', steps: '[]', servings: 3, prepTime: null, cookTime: null,
      imageUrl: null, notes: null, updatedAt: 't2',
    });

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE recipes'),
      ['Soup v2', '[]', 3, null, null, null, null, 't2', 'rec-1']
    );
  });

  it('soft-deletes a recipe\'s ingredients', () => {
    service.clearRecipeIngredients('rec-1', 't2');

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE recipe_ingredients SET isDeleted = 1'),
      ['t2', 'rec-1']
    );
  });

  it('hard-deletes a recipe\'s ingredients', () => {
    service.deleteRecipeIngredientsByRecipe('rec-1');

    expect(exec).toHaveBeenCalledWith('DELETE FROM recipe_ingredients WHERE recipeId = ?', ['rec-1']);
  });

  it('adds a recipe ingredient row', () => {
    service.addRecipeIngredient({ recipeId: 'rec-1', ingredientId: 'ing-1', quantity: 2, unit: 'cup', userId: 'u1', createdAt: 't1', updatedAt: 't1' });

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO recipe_ingredients'),
      ['rec-1', 'ing-1', 2, 'cup', 'u1', 1, 0, 't1', 't1']
    );
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

describe('DbService barcode migration', () => {
  let service: DbService;
  let SQL: any;
  let currentUserId: string | null;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: (file: string) => `${process.cwd()}/node_modules/sql.js/dist/${file}`,
    });
  });

  beforeEach(() => {
    currentUserId = null;
    TestBed.configureTestingModule({
      providers: [
        DbService,
        { provide: AuthService, useValue: { getCurrentUserId: () => currentUserId } },
      ],
    });
    service = TestBed.inject(DbService);
    const db = new SQL.Database();
    db.run(`
      CREATE TABLE inventory (
        id TEXT PRIMARY KEY, barcode TEXT, userId TEXT, isDeleted INTEGER DEFAULT 0
      );
      INSERT INTO inventory (id, barcode, userId, isDeleted) VALUES
        ('guest-first', '111', NULL, 0),
        ('guest-duplicate', '111', NULL, 0),
        ('user-first', '111', 'user-1', 0),
        ('other-user', '111', 'user-2', 0),
        ('deleted', '222', NULL, 1),
        ('empty', '', NULL, 0);
    `);
    (service as any).db = db;
  });

  it('preserves the first barcode per user or guest scope', () => {
    (service as any).migrateInventoryBarcodeIndex();

    const rows = (service as any).query<any>('SELECT id, barcode FROM inventory ORDER BY id');
    expect(rows).toEqual([
      { id: 'deleted', barcode: '222' },
      { id: 'empty', barcode: '' },
      { id: 'guest-duplicate', barcode: null },
      { id: 'guest-first', barcode: '111' },
      { id: 'other-user', barcode: '111' },
      { id: 'user-first', barcode: '111' },
    ]);
  });

  it('enforces uniqueness for active rows while allowing isolated scopes', () => {
    (service as any).migrateInventoryBarcodeIndex();

    expect(() => (service as any).db.run(
      "INSERT INTO inventory (id, barcode, userId) VALUES ('same-guest', '111', NULL)"
    )).toThrow();
    expect(() => (service as any).db.run(
      "INSERT INTO inventory (id, barcode, userId) VALUES ('same-user', '111', 'user-1')"
    )).toThrow();
    expect(() => (service as any).db.run(
      "INSERT INTO inventory (id, barcode, userId) VALUES ('new-user', '111', 'user-3')"
    )).not.toThrow();
    expect(() => (service as any).db.run(
      "INSERT INTO inventory (id, barcode, userId, isDeleted) VALUES ('deleted-copy', '222', NULL, 1)"
    )).not.toThrow();
  });

  it('returns only guest or current-user inventory rows', () => {
    (service as any).migrateInventoryBarcodeIndex();

    expect((service as any).queryByUser('inventory').map((row: any) => row.id)).toEqual([
      'guest-first', 'guest-duplicate', 'empty',
    ]);

    currentUserId = 'user-1';
    expect((service as any).queryByUser('inventory').map((row: any) => row.id)).toEqual(['user-first']);
  });
});