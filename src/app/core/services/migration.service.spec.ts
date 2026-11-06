import { MigrationService } from './migration.service';

const ALL_TABLES = ['ingredient_categories', 'ingredients', 'inventory', 'recipes', 'recipe_ingredients', 'meal_plans'];

function makeDb(counts: Partial<Record<string, number>> = {}) {
  return {
    query: vi.fn((sql: string) => {
      const table = ALL_TABLES.find(t => sql.includes(`FROM ${t} `));
      return [{ count: table ? counts[table] ?? 0 : 0 }];
    }),
    migrateLocalDataToUser: vi.fn(),
  };
}

function bare(): MigrationService & Record<string, any> {
  const service = Object.create(MigrationService.prototype) as MigrationService & Record<string, any>;
  service.migrationKey = 'pantrypal_migration_status';
  service.snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  return service;
}

describe('MigrationService', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('checkAndMigrate', () => {
    it('skips entirely when no user is authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      service.db = makeDb();

      await service.checkAndMigrate();

      expect(service.db.query).not.toHaveBeenCalled();
    });

    it('skips when migration was already marked complete for this user', async () => {
      localStorage.setItem(
        'pantrypal_migration_status',
        JSON.stringify({ u1: { completed: true } })
      );
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = makeDb({ inventory: 3 });

      await service.checkAndMigrate();

      expect(service.db.query).not.toHaveBeenCalled();
    });

    it('marks migration complete without migrating when there is no local data', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = makeDb();

      await service.checkAndMigrate();

      expect(service.db.migrateLocalDataToUser).not.toHaveBeenCalled();
      const status = JSON.parse(localStorage.getItem('pantrypal_migration_status')!);
      expect(status.u1.completed).toBe(true);
    });

    it('migrates local data, marks completion, and reports a pluralized count', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.sync = { syncNow: vi.fn(async () => {}) };
      service.db = makeDb({ inventory: 2, recipes: 1 });

      await service.checkAndMigrate();

      expect(service.db.migrateLocalDataToUser).toHaveBeenCalledWith('u1');
      expect(service.snackbar.success).toHaveBeenCalledWith('3 items migrated to your account!');
      const status = JSON.parse(localStorage.getItem('pantrypal_migration_status')!);
      expect(status.u1.completed).toBe(true);
    });

    it('uses singular wording when exactly one record is migrated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.sync = { syncNow: vi.fn(async () => {}) };
      service.db = makeDb({ inventory: 1 });

      await service.checkAndMigrate();

      expect(service.snackbar.success).toHaveBeenCalledWith('1 item migrated to your account!');
    });

    it('reports failure and leaves migration incomplete when migrateLocalDataToUser throws', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.sync = { syncNow: vi.fn() };
      service.db = makeDb({ inventory: 2 });
      service.db.migrateLocalDataToUser.mockImplementation(() => {
        throw new Error('disk error');
      });

      await service.checkAndMigrate();

      expect(service.snackbar.error).toHaveBeenCalledWith(
        'Failed to migrate local data. Please contact support.'
      );
      expect(localStorage.getItem('pantrypal_migration_status')).toBeNull();
    });

    it('triggers a sync shortly after a successful migration', async () => {
      vi.useFakeTimers();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      const syncNow = vi.fn(async () => {});
      service.sync = { syncNow };
      service.db = makeDb({ inventory: 1 });

      await service.checkAndMigrate();
      expect(syncNow).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);

      expect(syncNow).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('does not sync after migration if the user signed out in the meantime', async () => {
      vi.useFakeTimers();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => false };
      const syncNow = vi.fn(async () => {});
      service.sync = { syncNow };
      service.db = makeDb({ inventory: 1 });

      await service.checkAndMigrate();
      await vi.advanceTimersByTimeAsync(1000);

      expect(syncNow).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('resetMigrationStatus', () => {
    it('removes only the given user from the stored status', () => {
      localStorage.setItem(
        'pantrypal_migration_status',
        JSON.stringify({ u1: { completed: true }, u2: { completed: true } })
      );
      const service = bare();

      service.resetMigrationStatus('u1');

      const status = JSON.parse(localStorage.getItem('pantrypal_migration_status')!);
      expect(status).toEqual({ u2: { completed: true } });
    });

    it('clears the entire status key when no user is given', () => {
      localStorage.setItem(
        'pantrypal_migration_status',
        JSON.stringify({ u1: { completed: true } })
      );
      const service = bare();

      service.resetMigrationStatus();

      expect(localStorage.getItem('pantrypal_migration_status')).toBeNull();
    });
  });

  describe('forceMigration', () => {
    it('reports an error and skips migration when not signed in', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      service.db = makeDb({ inventory: 1 });

      await service.forceMigration();

      expect(service.snackbar.error).toHaveBeenCalledWith('Please sign in first');
      expect(service.db.migrateLocalDataToUser).not.toHaveBeenCalled();
    });

    it('resets prior status and re-runs migration', async () => {
      localStorage.setItem(
        'pantrypal_migration_status',
        JSON.stringify({ u1: { completed: true } })
      );
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1', isAuthenticated: () => true };
      service.sync = { syncNow: vi.fn(async () => {}) };
      service.db = makeDb({ inventory: 1 });

      await service.forceMigration();

      expect(service.db.migrateLocalDataToUser).toHaveBeenCalledWith('u1');
      expect(service.snackbar.success).toHaveBeenCalledWith('1 item migrated to your account!');
    });
  });
});
