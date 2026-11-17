import { signal } from '@angular/core';
import { SyncService, SyncStatus } from './sync.service';

const SYNC_TABLES = ['ingredient_categories', 'ingredients', 'inventory', 'recipes', 'recipe_ingredients', 'meal_plans'];

/**
 * Chainable Supabase table mock. `pages` are returned by successive `range()` calls;
 * `error` fails both reads and upserts.
 */
function supabaseTable(opts: { pages?: any[][]; error?: any; upsertError?: any } = {}) {
  const pages = [...(opts.pages ?? [])];
  const obj: any = {
    select: vi.fn(() => obj),
    gte: vi.fn(() => obj),
    in: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    order: vi.fn(() => obj),
    range: vi.fn(async () => (opts.error ? { data: null, error: opts.error } : { data: pages.shift() ?? [], error: null })),
    upsert: vi.fn(async () => ({ error: opts.upsertError ?? opts.error ?? null })),
  };
  return obj;
}

function makeDb(overrides: Record<string, any> = {}) {
  return {
    getChangedRecords: vi.fn(() => []),
    markRowsSynced: vi.fn().mockResolvedValue(undefined),
    getSyncCursor: vi.fn(() => null),
    setSyncCursor: vi.fn(),
    pruneSyncLog: vi.fn(),
    execBatch: vi.fn().mockResolvedValue(undefined),
    logSync: vi.fn(),
    query: vi.fn(() => []),
    exec: vi.fn(),
    getSyncStats: vi.fn(() => ({ unsyncedCount: 0, lastSyncTime: null, tables: {} })),
    ...overrides,
  };
}

function bare(): SyncService & Record<string, any> {
  const service = Object.create(SyncService.prototype) as SyncService & Record<string, any>;
  service.syncStatusSignal = signal<SyncStatus>('idle');
  service.lastSyncTimeSignal = signal<Date | null>(null);
  service.isSyncingSignal = signal<boolean>(false);
  service.syncStatus = service.syncStatusSignal.asReadonly();
  service.lastSyncTime = service.lastSyncTimeSignal.asReadonly();
  service.isSyncing = service.isSyncingSignal.asReadonly();
  service.SYNC_TABLES = SYNC_TABLES;
  service.CHILD_TABLES = new Set(['recipe_ingredients']);
  service.syncIntervalHandle = null;
  service.lastReportedErrors = '';
  service.onlineHandler = () => {
    if (service.auth.isAuthenticated() && !service.isSyncingSignal()) {
      service.syncNow();
    }
  };
  service.snackbar = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  service.errorHandler = { handle: vi.fn() };
  service.profileService = { updateLastSync: vi.fn().mockResolvedValue(undefined) };
  service.householdService = {
    household: signal({ id: 'h1' }),
    loadHousehold: vi.fn().mockResolvedValue(undefined),
    getHouseholdUserIds: vi.fn().mockResolvedValue(['u1']),
  };
  service.db = makeDb();
  service.supabase = { from: vi.fn(() => supabaseTable()) };
  return service;
}

/** Route `from(table)` to a specific mock for one table and empty mocks for the rest. */
function routeTables(service: Record<string, any>, tables: Record<string, any>) {
  service.supabase = { from: vi.fn((table: string) => tables[table] ?? supabaseTable()) };
}

describe('SyncService', () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    vi.restoreAllMocks();
  });

  describe('syncNow', () => {
    it('refuses to sync when no user is authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      const result = await service.syncNow();

      expect(result).toEqual({ success: false, pushedCount: 0, pulledCount: 0, conflictCount: 0, errors: ['Not authenticated'] });
      expect(service.snackbar.error).toHaveBeenCalledWith('Please sign in to sync your data');
    });

    it('marks status offline and warns instead of syncing when there is no connection', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const result = await service.syncNow();

      expect(service.syncStatus()).toBe('offline');
      expect(service.snackbar.warning).toHaveBeenCalledWith('No internet connection. Changes will sync when online.');
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['Offline']);
    });

    it('does not start a second sync while one is running', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.isSyncingSignal.set(true);

      const result = await service.syncNow();

      expect(result.errors).toEqual(['Sync already in progress']);
      expect(service.db.getChangedRecords).not.toHaveBeenCalled();
    });

    it('loads the household before pulling when it has not been loaded yet', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.householdService.household = signal(null);

      await service.syncNow();

      expect(service.householdService.loadHousehold).toHaveBeenCalled();
    });

    it('pushes a dirty record and marks exactly the pushed rows as synced', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const row = { id: 'i1', name: 'Flour', userId: 'u1', updatedAt: '2026-02-01T00:00:00.000Z', syncedAt: null };
      service.db = makeDb({ getChangedRecords: vi.fn((table: string) => (table === 'ingredients' ? [row] : [])) });
      const ingredientsTable = supabaseTable();
      routeTables(service, { ingredients: ingredientsTable });

      const result = await service.syncNow();

      expect(service.db.getChangedRecords).toHaveBeenCalledWith('ingredients');
      const [records] = ingredientsTable.upsert.mock.calls[0];
      expect(records[0]).toMatchObject({ id: 'i1', name: 'Flour', user_id: 'u1' });
      expect(records[0]).not.toHaveProperty('synced_at');
      expect(service.db.markRowsSynced).toHaveBeenCalledWith('ingredients', [row], expect.any(String));
      expect(service.db.logSync).toHaveBeenCalledWith('ingredients', 'push', 'i1', true);
      expect(result.pushedCount).toBe(1);
      expect(result.success).toBe(true);
      expect(service.syncStatus()).toBe('success');
    });

    it('pushes a child-table record without a user_id column', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const row = { recipeId: 'r1', ingredientId: 'i1', quantity: 2, userId: 'u1' };
      service.db = makeDb({ getChangedRecords: vi.fn((table: string) => (table === 'recipe_ingredients' ? [row] : [])) });
      const childTable = supabaseTable();
      routeTables(service, { recipe_ingredients: childTable });

      const result = await service.syncNow();

      const [records, options] = childTable.upsert.mock.calls[0];
      expect(records[0]).not.toHaveProperty('user_id');
      expect(options).toMatchObject({ onConflict: 'recipe_id,ingredient_id' });
      expect(service.db.markRowsSynced).toHaveBeenCalledWith('recipe_ingredients', [row], expect.any(String));
      expect(service.db.logSync).toHaveBeenCalledWith('recipe_ingredients', 'push', 'r1:i1', true);
      expect(result.pushedCount).toBe(1);
    });

    it('reports a failed push as an incomplete sync and keeps the rows dirty', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = makeDb({ getChangedRecords: vi.fn((table: string) => (table === 'ingredients' ? [{ id: 'i1', userId: 'u1' }] : [])) });
      routeTables(service, { ingredients: supabaseTable({ upsertError: { message: 'upsert failed' } }) });

      const result = await service.syncNow();

      expect(result.errors).toEqual(['Failed to push ingredients: upsert failed']);
      expect(service.db.markRowsSynced).not.toHaveBeenCalled();
      expect(service.db.logSync).toHaveBeenCalledWith('ingredients', 'push', '', false, 'Failed to push ingredients: upsert failed');
      expect(result.success).toBe(false);
      expect(service.syncStatus()).toBe('error');
      expect(service.snackbar.error).toHaveBeenCalledWith('Sync incomplete: 1 table(s) failed. Will retry.');
      expect(service.profileService.updateLastSync).not.toHaveBeenCalled();
    });

    it('reports a repeated background failure once, but always for a manual sync', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = makeDb({ getChangedRecords: vi.fn((table: string) => (table === 'ingredients' ? [{ id: 'i1', userId: 'u1' }] : [])) });
      routeTables(service, { ingredients: supabaseTable({ upsertError: { message: 'upsert failed' } }) });

      await service.syncNow();
      await service.syncNow();
      expect(service.snackbar.error).toHaveBeenCalledTimes(1);

      await service.syncNow({ manual: true });
      expect(service.snackbar.error).toHaveBeenCalledTimes(2);
    });

    it('reports a background failure again after a successful sync in between', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const failing = makeDb({ getChangedRecords: vi.fn((table: string) => (table === 'ingredients' ? [{ id: 'i1', userId: 'u1' }] : [])) });
      routeTables(service, { ingredients: supabaseTable({ upsertError: { message: 'upsert failed' } }) });

      service.db = failing;
      await service.syncNow();
      service.db = makeDb();
      await service.syncNow();
      service.db = failing;
      await service.syncNow();

      expect(service.snackbar.error).toHaveBeenCalledTimes(2);
    });

    it('inserts a newly pulled record and advances the cursor to the server timestamp', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const remoteRow = { id: 'i1', name: 'Flour', user_id: 'u1', updated_at: '2026-02-01T00:00:00+00:00', version: 1 };
      const ingredientsTable = supabaseTable({ pages: [[remoteRow]] });
      routeTables(service, { ingredients: ingredientsTable });

      const result = await service.syncNow();

      expect(ingredientsTable.gte).toHaveBeenCalledWith('updated_at', new Date(0).toISOString());
      expect(ingredientsTable.order).toHaveBeenCalledWith('updated_at', { ascending: true });
      expect(ingredientsTable.order).toHaveBeenCalledWith('id', { ascending: true });
      const [statements] = service.db.execBatch.mock.calls[0];
      expect(statements).toHaveLength(1);
      expect(statements[0].sql).toContain('INSERT INTO ingredients');
      // Local timestamps are normalized to ISO; the cursor keeps the server's own value.
      expect(statements[0].params).toContain('2026-02-01T00:00:00.000Z');
      expect(service.db.setSyncCursor).toHaveBeenCalledWith('u1', 'ingredients', '2026-02-01T00:00:00+00:00');
      expect(service.db.logSync).toHaveBeenCalledWith('ingredients', 'pull', 'i1', true);
      expect(result.pulledCount).toBe(1);
      expect(result.conflictCount).toBe(0);
    });

    it('resumes from the stored cursor for each table', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = makeDb({ getSyncCursor: vi.fn((_u: string, table: string) => (table === 'inventory' ? '2026-03-01T00:00:00Z' : null)) });
      const inventoryTable = supabaseTable();
      routeTables(service, { inventory: inventoryTable });

      await service.syncNow();

      expect(inventoryTable.gte).toHaveBeenCalledWith('updated_at', '2026-03-01T00:00:00Z');
    });

    it('reads every page until a short page is returned', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const size = SyncService.PULL_PAGE_SIZE;
      const page = (offset: number, n: number) =>
        Array.from({ length: n }, (_, i) => ({ id: `i${offset + i}`, user_id: 'u1', updated_at: `2026-02-01T00:00:${String((offset + i) % 60).padStart(2, '0')}Z`, version: 1 }));
      const ingredientsTable = supabaseTable({ pages: [page(0, size), page(size, 3)] });
      routeTables(service, { ingredients: ingredientsTable });

      const result = await service.syncNow();

      expect(ingredientsTable.range).toHaveBeenNthCalledWith(1, 0, size - 1);
      expect(ingredientsTable.range).toHaveBeenNthCalledWith(2, size, 2 * size - 1);
      expect(result.pulledCount).toBe(size + 3);
      expect(service.db.execBatch).toHaveBeenCalledTimes(1);
    });

    it('updates a clean local record with the pulled remote data', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const remoteRow = { id: 'i1', name: 'Flour', user_id: 'u1', updated_at: '2026-02-01T00:00:00.000Z', version: 2 };
      service.db = makeDb({
        query: vi.fn(() => [{ id: 'i1', name: 'Old', updatedAt: '2026-01-01T00:00:00.000Z', syncedAt: '2026-01-01T00:00:01.000Z', version: 1 }]),
      });
      routeTables(service, { ingredients: supabaseTable({ pages: [[remoteRow]] }) });

      const result = await service.syncNow();

      const [statements] = service.db.execBatch.mock.calls[0];
      expect(statements[0].sql).toMatch(/^UPDATE ingredients SET .* WHERE id=\?$/);
      expect(result.pulledCount).toBe(1);
      expect(result.conflictCount).toBe(0);
    });

    it('skips a remote row that is already applied locally', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const remoteRow = { id: 'i1', user_id: 'u1', updated_at: '2026-02-01T00:00:00.000Z', version: 2 };
      service.db = makeDb({
        query: vi.fn(() => [{ id: 'i1', updatedAt: '2026-02-01T00:00:00.000Z', syncedAt: '2026-02-01T00:00:05.000Z', version: 2 }]),
      });
      routeTables(service, { ingredients: supabaseTable({ pages: [[remoteRow]] }) });

      const result = await service.syncNow();

      expect(service.db.execBatch).not.toHaveBeenCalled();
      expect(service.db.setSyncCursor).toHaveBeenCalledWith('u1', 'ingredients', '2026-02-01T00:00:00.000Z');
      expect(result.pulledCount).toBe(0);
    });

    it('keeps unpushed local edits instead of overwriting them, and counts a conflict', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const remoteRow = { id: 'i1', name: 'Flour', user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', version: 1 };
      service.db = makeDb({
        query: vi.fn(() => [{ id: 'i1', name: 'Flour (local)', updatedAt: '2026-02-01T00:00:00.000Z', syncedAt: '2026-01-15T00:00:00.000Z', version: 2 }]),
      });
      routeTables(service, { ingredients: supabaseTable({ pages: [[remoteRow]] }) });

      const result = await service.syncNow();

      expect(result.conflictCount).toBe(1);
      expect(result.pulledCount).toBe(0);
      expect(service.db.execBatch).not.toHaveBeenCalled();
      expect(service.db.logSync).toHaveBeenCalledWith('ingredients', 'conflict', 'i1', false, 'Local changes not yet pushed');
      expect(service.snackbar.warning).toHaveBeenCalledWith('1 conflicts detected');
    });

    it('marks a pulled row synced at its own timestamp when the writer clock is ahead', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      routeTables(service, { ingredients: supabaseTable({ pages: [[{ id: 'i1', user_id: 'u2', updated_at: future, version: 1 }]] }) });

      await service.syncNow();

      const [statements] = service.db.execBatch.mock.calls[0];
      const sql: string = statements[0].sql;
      const columns = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',');
      expect(statements[0].params[columns.indexOf('syncedAt')]).toBe(future);
      expect(statements[0].params[columns.indexOf('updatedAt')]).toBe(future);
    });

    it('does not advance the cursor of a table whose pull failed, and reports the failure', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      routeTables(service, { ingredients: supabaseTable({ error: { message: 'network down' } }) });

      const result = await service.syncNow();

      expect(result.errors).toEqual(['Failed to pull ingredients: network down']);
      expect(service.db.setSyncCursor).not.toHaveBeenCalledWith('u1', 'ingredients', expect.anything());
      expect(service.db.logSync).toHaveBeenCalledWith('ingredients', 'pull', '', false, 'Failed to pull ingredients: network down');
      expect(result.success).toBe(false);
      expect(service.syncStatus()).toBe('error');
    });

    it('does not advance the cursor when applying the pulled rows fails', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = makeDb({ execBatch: vi.fn().mockRejectedValue(new Error('disk full')) });
      routeTables(service, { ingredients: supabaseTable({ pages: [[{ id: 'i1', user_id: 'u1', updated_at: '2026-02-01T00:00:00Z', version: 1 }]] }) });

      const result = await service.syncNow();

      expect(service.db.setSyncCursor).not.toHaveBeenCalled();
      expect(result.errors).toEqual(['Failed to pull ingredients: disk full']);
    });

    it('rejects pulled rows without a primary key and ignores non-allowlisted columns', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      routeTables(service, { ingredients: supabaseTable({ pages: [[{ evil_column: 'x' }]] }) });

      const result = await service.syncNow();

      expect(result.errors[0]).toBe('Failed to pull ingredients: Pulled ingredients row is missing its primary key');
      expect(service.db.execBatch).not.toHaveBeenCalled();
    });

    it('drops remote columns that are not in the local allowlist', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      routeTables(service, { ingredients: supabaseTable({ pages: [[{ id: 'i1', 'name); DROP TABLE x;--': 'x', updated_at: '2026-02-01T00:00:00Z' }]] }) });

      await service.syncNow();

      const [statements] = service.db.execBatch.mock.calls[0];
      expect(statements[0].sql).not.toContain('DROP');
    });

    it('skips pulling recipe_ingredients when the household has no shared recipes locally', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const childTable = supabaseTable({ pages: [[{ recipe_id: 'r1', ingredient_id: 'i1' }]] });
      routeTables(service, { recipe_ingredients: childTable });

      await service.syncNow();

      expect(childTable.select).not.toHaveBeenCalled();
    });

    it('pulls recipe_ingredients for shared recipes, ordered by composite key and chunked by recipe id', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const recipeIds = Array.from({ length: 150 }, (_, i) => ({ id: `r${i}` }));
      service.db = makeDb({ query: vi.fn((sql: string) => (sql.includes('FROM recipes') ? recipeIds : [])) });
      const remoteRow = { recipe_id: 'r1', ingredient_id: 'i1', quantity: 3, updated_at: '2026-02-01T00:00:00.000Z', version: 1 };
      const childTable = supabaseTable({ pages: [[remoteRow], []] });
      routeTables(service, { recipe_ingredients: childTable });

      const result = await service.syncNow();

      expect(childTable.in).toHaveBeenCalledTimes(2);
      expect(childTable.in.mock.calls[0][1]).toHaveLength(100);
      expect(childTable.in.mock.calls[1][1]).toHaveLength(50);
      expect(childTable.order).toHaveBeenCalledWith('recipe_id', { ascending: true });
      expect(childTable.order).toHaveBeenCalledWith('ingredient_id', { ascending: true });
      const [statements] = service.db.execBatch.mock.calls[0];
      expect(statements[0].sql).toContain('INSERT INTO recipe_ingredients');
      expect(service.db.logSync).toHaveBeenCalledWith('recipe_ingredients', 'pull', 'r1:i1', true);
      expect(result.pulledCount).toBe(1);
    });

    it('updates an existing recipe ingredient by its composite key', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = makeDb({
        query: vi.fn((sql: string) =>
          sql.includes('FROM recipes')
            ? [{ id: 'r1' }]
            : sql.includes('FROM recipe_ingredients')
              ? [{ recipeId: 'r1', ingredientId: 'i1', updatedAt: '2026-01-01T00:00:00.000Z', syncedAt: '2026-01-02T00:00:00.000Z', version: 1 }]
              : []
        ),
      });
      const remoteRow = { recipe_id: 'r1', ingredient_id: 'i1', quantity: 5, updated_at: '2026-02-01T00:00:00.000Z', version: 2 };
      routeTables(service, { recipe_ingredients: supabaseTable({ pages: [[remoteRow]] }) });

      await service.syncNow();

      const [statements] = service.db.execBatch.mock.calls[0];
      expect(statements[0].sql).toMatch(/WHERE recipeId=\? AND ingredientId=\?$/);
      expect(statements[0].params.slice(-2)).toEqual(['r1', 'i1']);
    });

    it('pulls changes scoped to every member of a multi-person household', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.householdService.getHouseholdUserIds = vi.fn().mockResolvedValue(['u1', 'u2']);
      const ingredientsTable = supabaseTable();
      routeTables(service, { ingredients: ingredientsTable });

      await service.syncNow();

      expect(ingredientsTable.in).toHaveBeenCalledWith('user_id', ['u1', 'u2']);
    });

    it('calls updateLastSync, prunes old log entries and records the last sync time on success', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };

      await service.syncNow();

      expect(service.profileService.updateLastSync).toHaveBeenCalled();
      expect(service.db.pruneSyncLog).toHaveBeenCalledWith(expect.any(String));
      expect(service.lastSyncTime()).toBeInstanceOf(Date);
    });

    it('shows a success snackbar only when something was actually pushed or pulled', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };

      await service.syncNow();

      expect(service.snackbar.success).not.toHaveBeenCalled();
    });

    it('routes an unexpected error to the error handler and reports failure', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.householdService.getHouseholdUserIds = vi.fn().mockRejectedValue(new Error('household lookup failed'));

      const result = await service.syncNow();

      expect(service.errorHandler.handle).toHaveBeenCalledWith(expect.any(Error), 'Sync failed');
      expect(service.syncStatus()).toBe('error');
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['household lookup failed']);
    });

    it('always clears the syncing flag, even after an unexpected error', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.householdService.getHouseholdUserIds = vi.fn().mockRejectedValue(new Error('boom'));

      await service.syncNow();

      expect(service.isSyncing()).toBe(false);
    });
  });

  describe('auto-sync lifecycle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('syncs immediately on start, so a fresh sign-in does not wait for the first interval', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5);

      expect(service.syncNow).toHaveBeenCalledTimes(1);
      service.stopAutoSync();
    });

    it('does not sync immediately when signed out', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null, isAuthenticated: () => false };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5);

      expect(service.syncNow).not.toHaveBeenCalled();
      service.stopAutoSync();
    });

    it('triggers a sync on each interval while authenticated and online', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5, false);
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(service.syncNow).toHaveBeenCalledTimes(1);
      service.stopAutoSync();
    });

    it('does not trigger a sync on the interval once stopped', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5, false);
      service.stopAutoSync();
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(service.syncNow).not.toHaveBeenCalled();
    });

    it('replaces any previous interval when started again', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5, false);
      const firstHandle = service.syncIntervalHandle;
      service.startAutoSync(10, false);

      expect(service.syncIntervalHandle).not.toBe(firstHandle);
      service.stopAutoSync();
    });

    it('triggers a sync when the browser comes back online', () => {
      const service = bare();
      service.auth = { isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5, false);
      window.dispatchEvent(new Event('online'));

      expect(service.syncNow).toHaveBeenCalled();
      service.stopAutoSync();
    });

    it('does not sync on the online event once stopped', () => {
      const service = bare();
      service.auth = { isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5, false);
      service.stopAutoSync();
      window.dispatchEvent(new Event('online'));

      expect(service.syncNow).not.toHaveBeenCalled();
    });
  });

  describe('getSyncStats', () => {
    it('delegates to the database service', () => {
      const service = bare();
      const stats = { unsyncedCount: 3, lastSyncTime: '2026-01-01T00:00:00.000Z', tables: {} };
      service.db = makeDb({ getSyncStats: vi.fn(() => stats) });

      expect(service.getSyncStats()).toBe(stats);
    });
  });

  describe('resetSyncStatus', () => {
    it('resets status to idle and clears the last sync time', () => {
      const service = bare();
      service.syncStatusSignal.set('error');
      service.lastSyncTimeSignal.set(new Date());

      service.resetSyncStatus();

      expect(service.syncStatus()).toBe('idle');
      expect(service.lastSyncTime()).toBeNull();
    });
  });
});
