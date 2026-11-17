import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { DB_TABLE_COLUMNS, DbService } from './db.service';
import { UserProfileService } from './user-profile.service';
import { SnackbarService } from './snackbar.service';
import { ErrorHandlerService } from './error-handler.service';
import { HouseholdService } from './household.service';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  conflictCount: number;
  errors: string[];
}

@Injectable({
  providedIn: 'root',
})
export class SyncService {
  private auth = inject(AuthService);
  private db = inject(DbService);
  private profileService = inject(UserProfileService);
  private snackbar = inject(SnackbarService);
  private errorHandler = inject(ErrorHandlerService);
  private householdService = inject(HouseholdService);

  private supabase = this.auth.getSupabaseClient();

  // Reactive state
  private syncStatusSignal = signal<SyncStatus>('idle');
  private lastSyncTimeSignal = signal<Date | null>(null);
  private isSyncingSignal = signal<boolean>(false);

  // Public readonly signals
  syncStatus = this.syncStatusSignal.asReadonly();
  lastSyncTime = this.lastSyncTimeSignal.asReadonly();
  isSyncing = this.isSyncingSignal.asReadonly();

  // Tables to sync (in order of dependencies)
  private readonly SYNC_TABLES = [
    'ingredient_categories',
    'ingredients',
    'inventory',
    'recipes',
    'recipe_ingredients',
    'meal_plans',
  ];

  /** Rows fetched per pull request; below Supabase's default 1000-row response cap. */
  static readonly PULL_PAGE_SIZE = 500;
  /** Max recipe ids per `in()` filter, to keep request URLs short. */
  private static readonly ID_CHUNK = 100;
  /** Sync log entries older than this are pruned after each sync. */
  private static readonly SYNC_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  private static readonly EPOCH = new Date(0).toISOString();

  /**
   * Sync now - push local changes and pull remote changes
   */
  /** Errors last shown to the user, so background retries do not repeat the same message. */
  private lastReportedErrors = '';

  /**
   * @param options.manual true when the user asked for this sync; failures are then always reported.
   */
  async syncNow(options: { manual?: boolean } = {}): Promise<SyncResult> {
    const userId = this.auth.getCurrentUserId();

    if (!userId) {
      this.snackbar.error('Please sign in to sync your data');
      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        conflictCount: 0,
        errors: ['Not authenticated'],
      };
    }

    if (!navigator.onLine) {
      this.syncStatusSignal.set('offline');
      this.snackbar.warning('No internet connection. Changes will sync when online.');
      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        conflictCount: 0,
        errors: ['Offline'],
      };
    }

    // Overlapping runs (auto-sync, online event, post-migration sync, manual button) would
    // read the same dirty rows and cursors; let the running sync finish instead.
    if (this.isSyncingSignal()) {
      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        conflictCount: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.isSyncingSignal.set(true);
    this.syncStatusSignal.set('syncing');

    const result: SyncResult = {
      success: true,
      pushedCount: 0,
      pulledCount: 0,
      conflictCount: 0,
      errors: [],
    };

    try {
      // Household membership decides whose rows are pulled; it is otherwise only loaded by the settings page.
      if (!this.householdService.household()) {
        await this.householdService.loadHousehold();
      }

      // Push local changes to cloud
      const pushResult = await this.pushChanges(userId);
      result.pushedCount = pushResult.count;
      result.errors.push(...pushResult.errors);

      // Pull remote changes to local
      const pullResult = await this.pullChanges(userId);
      result.pulledCount = pullResult.count;
      result.conflictCount = pullResult.conflicts;
      result.errors.push(...pullResult.errors);

      this.db.pruneSyncLog(new Date(Date.now() - SyncService.SYNC_LOG_RETENTION_MS).toISOString());

      if (result.errors.length > 0) {
        // A partially failed sync must not look successful: failed tables keep their
        // dirty rows and pull cursors, and are retried on the next run.
        result.success = false;
        this.syncStatusSignal.set('error');
        const errorKey = result.errors.join('|');
        if (options.manual || errorKey !== this.lastReportedErrors) {
          this.snackbar.error(`Sync incomplete: ${result.errors.length} table(s) failed. Will retry.`);
        }
        this.lastReportedErrors = errorKey;
        return result;
      }

      // Update last sync time in profile
      await this.profileService.updateLastSync();

      this.lastSyncTimeSignal.set(new Date());
      this.syncStatusSignal.set('success');
      this.lastReportedErrors = '';

      if (result.pushedCount > 0 || result.pulledCount > 0) {
        this.snackbar.success(
          `Synced: ${result.pushedCount} pushed, ${result.pulledCount} pulled`
        );
      }

      if (result.conflictCount > 0) {
        this.snackbar.warning(`${result.conflictCount} conflicts detected`);
      }

      return result;
    } catch (error) {
      console.error('Sync error:', error);
      this.syncStatusSignal.set('error');
      this.errorHandler.handle(error, 'Sync failed');

      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');

      return result;
    } finally {
      this.isSyncingSignal.set(false);
    }
  }

  /**
   * Get the primary key config for a table
   */
  private getTableKeyConfig(table: string): { columns: string[]; onConflict: string } {
    if (table === 'recipe_ingredients') {
      return { columns: ['recipe_id', 'ingredient_id'], onConflict: 'recipe_id,ingredient_id' };
    }
    return { columns: ['id'], onConflict: 'id' };
  }

  /**
   * Tables that reference ownership via their parent (no direct user_id column)
   */
  private readonly CHILD_TABLES = new Set(['recipe_ingredients']);

  /**
   * Get the record identifier string for logging
   */
  private getRecordId(record: any, table: string): string {
    if (table === 'recipe_ingredients') {
      return `${record.recipe_id ?? record.recipeId}:${record.ingredient_id ?? record.ingredientId}`;
    }
    return record.id ?? '';
  }

  /**
   * Convert a camelCase key to snake_case
   */
  private toSnake(str: string): string {
    return str.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
  }

  /**
   * Convert all keys in a local record to snake_case for Supabase, removing local-only fields
   */
  private localToRemote(record: any, userId: string, isChildTable = false): any {
    const result: any = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === 'syncedAt') continue; // local-only tracking field
      result[this.toSnake(key)] = value;
    }
    if (!isChildTable) {
      result['user_id'] = userId;
    } else {
      delete result['user_id']; // child tables inherit ownership via parent; no user_id column
    }
    result['updated_at'] = new Date().toISOString();
    delete result['user_id_id']; // safety
    return result;
  }

  /**
   * Normalize a timestamp to the ISO form used locally, so text comparisons between
   * local `updatedAt` and `syncedAt` stay meaningful whatever format the server returns.
   */
  private toIso(value: unknown): string | null {
    if (typeof value !== 'string' || value === '') return null;
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? value : new Date(ms).toISOString();
  }

  /**
   * Convert snake_case Supabase record back to camelCase for local storage
   */
  private remoteToLocal(record: any): any {
    const result: any = {};
    for (const [key, value] of Object.entries(record)) {
      const camel = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
      result[camel] = value;
    }
    const updatedAt = this.toIso(result['updatedAt']);
    if (updatedAt) result['updatedAt'] = updatedAt;
    // A pulled row is clean. If the writer's clock ran ahead of ours, mark it synced at its
    // own timestamp so it is not mistaken for a local edit and pushed straight back.
    const now = new Date().toISOString();
    result['syncedAt'] = updatedAt && updatedAt > now ? updatedAt : now;
    return result;
  }

  /** True when a local row has edits that have not been pushed. */
  private isDirty(local: any): boolean {
    return !local.syncedAt || (!!local.updatedAt && local.updatedAt > local.syncedAt);
  }

  /**
   * Push local changes to Supabase
   */
  private async pushChanges(userId: string): Promise<{ count: number; errors: string[] }> {
    let count = 0;
    const errors: string[] = [];

    for (const table of this.SYNC_TABLES) {
      try {
        // Rows edited since their own last sync, independent of other tables' progress
        const changes = this.db.getChangedRecords(table);

        if (changes.length === 0) {
          continue;
        }

        const keyConfig = this.getTableKeyConfig(table);
        const isChild = this.CHILD_TABLES.has(table);

        // Convert local camelCase records to snake_case Supabase format
        const records = changes.map((record: any) => this.localToRemote(record, userId, isChild));

        // Upsert to Supabase (insert or update)
        const { error } = await this.supabase.from(table).upsert(records, {
          onConflict: keyConfig.onConflict,
          ignoreDuplicates: false,
        });

        if (error) {
          throw error;
        }

        // Mark only the rows that were not edited again while the upsert was in flight
        await this.db.markRowsSynced(table, changes, new Date().toISOString());

        // Log success
        changes.forEach((r: any) => this.db.logSync(table, 'push', this.getRecordId(r, table), true));

        count += changes.length;
      } catch (error) {
        const errorMsg = `Failed to push ${table}: ${this.describeError(error)}`;
        errors.push(errorMsg);
        console.error(errorMsg);

        // Log failure
        this.db.logSync(table, 'push', '', false, errorMsg);
      }
    }

    return { count, errors };
  }

  /**
   * Fetch every remote row changed at or after the table's cursor, page by page in a stable order.
   * Rows equal to the cursor are re-read so rows sharing a timestamp are never skipped;
   * unchanged rows are filtered out when applied.
   */
  private async fetchRemoteChanges(table: string, cursor: string, pullUserIds: string[], recipeIds: string[] | null): Promise<any[]> {
    const isChild = this.CHILD_TABLES.has(table);
    const pageSize = SyncService.PULL_PAGE_SIZE;
    const filters: string[][] = isChild ? this.chunk(recipeIds ?? [], SyncService.ID_CHUNK) : [pullUserIds];
    const rows: any[] = [];

    for (const ids of filters) {
      for (let from = 0; ; from += pageSize) {
        let query = this.supabase.from(table).select('*').gte('updated_at', cursor);
        query = isChild ? query.in('recipe_id', ids) : query.in('user_id', ids);
        query = query.order('updated_at', { ascending: true });
        query = isChild
          ? query.order('recipe_id', { ascending: true }).order('ingredient_id', { ascending: true })
          : query.order('id', { ascending: true });

        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) {
          throw error;
        }

        const page = data ?? [];
        rows.push(...page);
        if (page.length < pageSize) {
          break;
        }
      }
    }

    return rows;
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      out.push(items.slice(i, i + size));
    }
    return out;
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error) return String((error as any).message);
    return String(error);
  }

  /**
   * Pull remote changes from Supabase
   */
  private async pullChanges(userId: string): Promise<{ count: number; conflicts: number; errors: string[] }> {
    let count = 0;
    let conflicts = 0;
    const errors: string[] = [];

    // Get all user IDs in the household (includes self)
    const householdUserIds = await this.householdService.getHouseholdUserIds();
    const pullUserIds = householdUserIds.length > 1 ? householdUserIds : [userId];

    for (const table of this.SYNC_TABLES) {
      try {
        const isChild = this.CHILD_TABLES.has(table);
        const cursor = this.db.getSyncCursor(userId, table) ?? SyncService.EPOCH;

        let recipeIds: string[] | null = null;
        if (isChild) {
          // For child tables (recipe_ingredients), include recipes from all household members (BUG-20)
          const placeholders = pullUserIds.map(() => '?').join(',');
          recipeIds = this.db.query<{id: string}>(
            `SELECT id FROM recipes WHERE userId IN (${placeholders}) AND (isDeleted IS NULL OR isDeleted = 0)`,
            pullUserIds
          ).map(r => r.id);
          if (recipeIds.length === 0) continue;
        }

        const data = await this.fetchRemoteChanges(table, cursor, pullUserIds, recipeIds);

        if (data.length === 0) {
          continue;
        }

        // The cursor comes from the server's own values, never from this device's clock.
        const nextCursor: string = data[data.length - 1].updated_at ?? cursor;

        // Convert snake_case Supabase records to camelCase for local storage
        const records = data.map((record: any) => this.remoteToLocal(record));

        // Build WHERE clause for finding existing records
        const findExistingQuery = isChild
          ? `SELECT * FROM ${table} WHERE recipeId = ? AND ingredientId = ?`
          : `SELECT * FROM ${table} WHERE id = ?`;

        const getFindParams = (record: any) => isChild
          ? [record.recipeId, record.ingredientId]
          : [record.id];

        // Filter columns against allowlist to prevent SQL injection via remote column names (BUG-12)
        const allowedCols = DB_TABLE_COLUMNS[table] ?? [];
        const statements: Array<{ sql: string; params: any[] }> = [];
        const applied: any[] = [];
        let tableConflicts = 0;

        for (const remoteRecord of records) {
          const keyMissing = isChild ? !remoteRecord.recipeId || !remoteRecord.ingredientId : !remoteRecord.id;
          if (keyMissing) {
            throw new Error(`Pulled ${table} row is missing its primary key`);
          }
          const columns = Object.keys(remoteRecord).filter(c => allowedCols.includes(c));
          const values = columns.map((col) => remoteRecord[col]);
          const local = this.db.query(findExistingQuery, getFindParams(remoteRecord))[0];

          if (local) {
            if (this.isDirty(local)) {
              // Unpushed local edits win for now; they are pushed on the next run.
              tableConflicts++;
              this.db.logSync(table, 'conflict', this.getRecordId(remoteRecord, table), false, 'Local changes not yet pushed');
              continue;
            }
            if (local.updatedAt === remoteRecord.updatedAt && local.version === remoteRecord.version) {
              continue; // already applied (re-read at the cursor boundary)
            }

            const setClause = columns.map((col) => `${col}=?`).join(',');
            statements.push(isChild
              ? { sql: `UPDATE ${table} SET ${setClause} WHERE recipeId=? AND ingredientId=?`, params: [...values, remoteRecord.recipeId, remoteRecord.ingredientId] }
              : { sql: `UPDATE ${table} SET ${setClause} WHERE id=?`, params: [...values, remoteRecord.id] });
          } else {
            statements.push({
              sql: `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
              params: values,
            });
          }
          applied.push(remoteRecord);
        }

        // One transaction and one persist per table
        if (statements.length > 0) {
          await this.db.execBatch(statements);
        }
        this.db.setSyncCursor(userId, table, nextCursor);

        applied.forEach((r) => this.db.logSync(table, 'pull', this.getRecordId(r, table), true));
        count += applied.length;
        conflicts += tableConflicts;
      } catch (error) {
        const errorMsg = `Failed to pull ${table}: ${this.describeError(error)}`;
        errors.push(errorMsg);
        console.error(errorMsg);

        // Log failure
        this.db.logSync(table, 'pull', '', false, errorMsg);
      }
    }

    return { count, conflicts, errors };
  }

  // Named reference so we can remove the listener in stopAutoSync (BUG-03)
  private readonly onlineHandler = () => {
    if (this.auth.isAuthenticated() && !this.isSyncingSignal()) {
      console.log('Back online - triggering sync');
      this.syncNow();
    }
  };

  // Typed interval handle instead of window global (BUG-04)
  private syncIntervalHandle: ReturnType<typeof setInterval> | null = null;

  /**
   * Start auto-sync (periodic background sync)
   */
  startAutoSync(intervalMinutes: number = 5, syncImmediately = true): void {
    // Always clean up first to avoid duplicate listeners/intervals
    this.stopAutoSync();

    // Sync right away (e.g. after sign-in) instead of waiting for the first interval
    if (syncImmediately && this.auth.isAuthenticated() && navigator.onLine) {
      void this.syncNow();
    }

    const intervalMs = intervalMinutes * 60 * 1000;

    this.syncIntervalHandle = setInterval(async () => {
      if (this.auth.isAuthenticated() && navigator.onLine && !this.isSyncingSignal()) {
        await this.syncNow();
      }
    }, intervalMs);

    console.log(`Auto-sync started (every ${intervalMinutes} minutes)`);

    // Also sync when coming back online
    window.addEventListener('online', this.onlineHandler);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncIntervalHandle !== null) {
      clearInterval(this.syncIntervalHandle);
      this.syncIntervalHandle = null;
      console.log('Auto-sync stopped');
    }
    window.removeEventListener('online', this.onlineHandler);
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    return this.db.getSyncStats();
  }

  /**
   * Clear sync status (for testing)
   */
  resetSyncStatus(): void {
    this.syncStatusSignal.set('idle');
    this.lastSyncTimeSignal.set(null);
  }
}
