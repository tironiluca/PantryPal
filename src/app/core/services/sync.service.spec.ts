import { signal } from '@angular/core';
import { SyncService, SyncStatus } from './sync.service';

const SYNC_TABLES = ['ingredient_categories', 'ingredients', 'inventory', 'recipes', 'recipe_ingredients', 'meal_plans'];

function supabaseTable(result: { data?: any; error?: any } = { data: null, error: null }) {
  const obj: any = {
    select: vi.fn(() => obj),
    gt: vi.fn(() => obj),
    in: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    upsert: vi.fn(async () => ({ error: result.error ?? null })),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
  return obj;
}

function makeDb(overrides: Record<string, any> = {}) {
  return {
    getChangedRecords: vi.fn(() => []),
    markAsSynced: vi.fn(),
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
  service.onlineHandler = () => {
    if (service.auth.isAuthenticated() && !service.isSyncingSignal()) {
      service.syncNow();
    }
  };
  service.snackbar = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  service.errorHandler = { handle: vi.fn() };
  service.profileService = { updateLastSync: vi.fn().mockResolvedValue(undefined) };
  service.householdService = { getHouseholdUserIds: vi.fn().mockResolvedValue(['u1']) };
  service.db = makeDb();
  service.supabase = { from: vi.fn(() => supabaseTable()) };
  return service;
}

describe('SyncService', () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
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

    it('pushes a changed record, marks it synced, and reports the pushed count', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = makeDb({
        getChangedRecords: vi.fn((table: string) => (table === 'ingredients' ? [{ id: 'i1', name: 'Flour', userId: 'u1' }] : [])),
      });
      const ingredientsTable = supabaseTable({ error: null });
      service.supabase = { from: vi.fn((table: string) => (table === 'ingredients' ? ingredientsTable : supabaseTable())) };

      const result = await service.syncNow();

      expect(ingredientsTable.upsert).toHaveBeenCalled();
      expect(service.db.markAsSynced).toHaveBeenCalledWith('ingredients', ['i1'], expect.any(String));
      expect(service.db.logSync).toHaveBeenCalledWith('ingredients', 'push', 'i1', true);
      expect(result.pushedCount).toBe(1);
      expect(result.success).toBe(true);
      expect(service.syncStatus()).toBe('success');
    });

    it('pushes a child-table record using its composite key and update statement', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = makeDb({
        getChangedRecords: vi.fn((table: string) =>
          table === 'recipe_ingredients' ? [{ recipeId: 'r1', ingredientId: 'i1', quantity: 2 }] : []
        ),
      });
      const childTable = supabaseTable({ error: null });
      service.supabase = { from: vi.fn((table: string) => (table === 'recipe_ingredients' ? childTable : supabaseTable())) };

      const result = await service.syncNow();

      expect(service.db.exec).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE recipe_ingredients SET syncedAt = ?, version = version + 1'),
        [expect.any(String), 'r1', 'i1']
      );
      expect(service.db.logSync).toHaveBeenCalledWith('recipe_ingredients', 'push', 'r1:i1', true);
      expect(result.pushedCount).toBe(1);
    });

    it('records a push failure for one table without aborting the others', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = makeDb({
        getChangedRecords: vi.fn((table: string) => (table === 'ingredients' ? [{ id: 'i1', userId: 'u1' }] : [])),
      });
      service.supabase = {
        from: vi.fn((table: string) => (table === 'ingredients' ? supabaseTable({ error: new Error('upsert failed') }) : supabaseTable())),
      };

      const result = await service.syncNow();

      expect(result.errors.some((e: string) => e.includes('Failed to push ingredients'))).toBe(true);
      expect(service.db.logSync).toHaveBeenCalledWith('ingredients', 'push', '', false, expect.stringContaining('Failed to push ingredients'));
      expect(result.pushedCount).toBe(0);
    });

    it('inserts a newly pulled record that does not exist locally', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const remoteRow = { id: 'i1', name: 'Flour', user_id: 'u1', updated_at: '2026-02-01T00:00:00.000Z', version: 1 };
      service.supabase = {
        from: vi.fn((table: string) => (table === 'ingredients' ? supabaseTable({ data: [remoteRow], error: null }) : supabaseTable())),
      };

      const result = await service.syncNow();

      expect(service.db.exec).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ingredients'), expect.any(Array));
      expect(service.db.logSync).toHaveBeenCalledWith('ingredients', 'pull', 'i1', true);
      expect(result.pulledCount).toBe(1);
      expect(result.conflictCount).toBe(0);
    });

    it('updates an existing local record with the pulled remote data when there is no conflict', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const remoteRow = { id: 'i1', name: 'Flour', user_id: 'u1', updated_at: '2026-02-01T00:00:00.000Z', version: 2 };
      service.db = makeDb({
        query: vi.fn(() => [{ id: 'i1', name: 'Flour', updatedAt: '2026-01-01T00:00:00.000Z', version: 1 }]),
      });
      service.supabase = {
        from: vi.fn((table: string) => (table === 'ingredients' ? supabaseTable({ data: [remoteRow], error: null }) : supabaseTable())),
      };

      const result = await service.syncNow();

      expect(service.db.exec).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients SET'), expect.any(Array));
      expect(result.pulledCount).toBe(1);
      expect(result.conflictCount).toBe(0);
    });

    it('flags a conflict when the local record is newer and has a different version than remote', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const remoteRow = { id: 'i1', name: 'Flour', user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', version: 1 };
      service.db = makeDb({
        query: vi.fn(() => [{ id: 'i1', name: 'Flour (local)', updatedAt: '2026-02-01T00:00:00.000Z', version: 2 }]),
      });
      service.supabase = {
        from: vi.fn((table: string) => (table === 'ingredients' ? supabaseTable({ data: [remoteRow], error: null }) : supabaseTable())),
      };

      const result = await service.syncNow();

      expect(result.conflictCount).toBe(1);
      expect(result.pulledCount).toBe(0);
      expect(service.db.logSync).toHaveBeenCalledWith('ingredients', 'conflict', 'i1', false, 'Version conflict');
      expect(service.snackbar.warning).toHaveBeenCalledWith('1 conflicts detected');
    });

    it('records a pull failure for one table without aborting the others', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.supabase = {
        from: vi.fn((table: string) => (table === 'ingredients' ? supabaseTable({ error: new Error('network down') }) : supabaseTable())),
      };

      const result = await service.syncNow();

      expect(result.errors.some((e: string) => e.includes('Failed to pull ingredients'))).toBe(true);
      expect(service.db.logSync).toHaveBeenCalledWith('ingredients', 'pull', '', false, expect.stringContaining('Failed to pull ingredients'));
    });

    it('skips pulling recipe_ingredients when the household has no shared recipes locally', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const childTable = supabaseTable({ data: [{ recipe_id: 'r1', ingredient_id: 'i1' }], error: null });
      service.db = makeDb({ query: vi.fn(() => []) });
      service.supabase = { from: vi.fn((table: string) => (table === 'recipe_ingredients' ? childTable : supabaseTable())) };

      await service.syncNow();

      expect(childTable.in).not.toHaveBeenCalled();
    });

    it('pulls recipe_ingredients for recipes shared within the household', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const remoteRow = { recipe_id: 'r1', ingredient_id: 'i1', quantity: 3, updated_at: '2026-02-01T00:00:00.000Z', version: 1 };
      service.db = makeDb({
        query: vi.fn((sql: string) => (sql.includes('FROM recipes') ? [{ id: 'r1' }] : [])),
      });
      const childTable = supabaseTable({ data: [remoteRow], error: null });
      service.supabase = { from: vi.fn((table: string) => (table === 'recipe_ingredients' ? childTable : supabaseTable())) };

      const result = await service.syncNow();

      expect(childTable.in).toHaveBeenCalledWith('recipe_id', ['r1']);
      expect(service.db.logSync).toHaveBeenCalledWith('recipe_ingredients', 'pull', 'r1:i1', true);
      expect(result.pulledCount).toBe(1);
    });

    it('pulls changes scoped to every member of a multi-person household', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.householdService = { getHouseholdUserIds: vi.fn().mockResolvedValue(['u1', 'u2']) };
      const ingredientsTable = supabaseTable({ data: [], error: null });
      service.supabase = { from: vi.fn((table: string) => (table === 'ingredients' ? ingredientsTable : supabaseTable())) };

      await service.syncNow();

      expect(ingredientsTable.in).toHaveBeenCalledWith('user_id', ['u1', 'u2']);
    });

    it('calls updateLastSync and records the last sync time on success', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };

      await service.syncNow();

      expect(service.profileService.updateLastSync).toHaveBeenCalled();
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
      service.householdService = { getHouseholdUserIds: vi.fn().mockRejectedValue(new Error('household lookup failed')) };

      const result = await service.syncNow();

      expect(service.errorHandler.handle).toHaveBeenCalledWith(expect.any(Error), 'Sync failed');
      expect(service.syncStatus()).toBe('error');
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['household lookup failed']);
    });

    it('always clears the syncing flag, even after an unexpected error', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.householdService = { getHouseholdUserIds: vi.fn().mockRejectedValue(new Error('boom')) };

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

    it('triggers a sync on each interval while authenticated and online', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5);
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(service.syncNow).toHaveBeenCalledTimes(1);
      service.stopAutoSync();
    });

    it('does not trigger a sync on the interval once stopped', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5);
      service.stopAutoSync();
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(service.syncNow).not.toHaveBeenCalled();
    });

    it('replaces any previous interval when started again', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5);
      const firstHandle = service.syncIntervalHandle;
      service.startAutoSync(10);

      expect(service.syncIntervalHandle).not.toBe(firstHandle);
      service.stopAutoSync();
    });

    it('triggers a sync when the browser comes back online', () => {
      const service = bare();
      service.auth = { isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5);
      window.dispatchEvent(new Event('online'));

      expect(service.syncNow).toHaveBeenCalled();
      service.stopAutoSync();
    });

    it('does not sync on the online event once stopped', () => {
      const service = bare();
      service.auth = { isAuthenticated: () => true };
      service.syncNow = vi.fn().mockResolvedValue(undefined);

      service.startAutoSync(5);
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
