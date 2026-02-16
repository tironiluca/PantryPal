import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { DbService } from './db.service';
import { UserProfileService } from './user-profile.service';
import { SnackbarService } from './snackbar.service';
import { ErrorHandlerService } from './error-handler.service';

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
  ];

  /**
   * Sync now - push local changes and pull remote changes
   */
  async syncNow(): Promise<SyncResult> {
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
      // Get last sync time
      const stats = this.db.getSyncStats();
      const lastSyncTime = stats.lastSyncTime || new Date(0).toISOString();

      // Push local changes to cloud
      const pushResult = await this.pushChanges(userId, lastSyncTime);
      result.pushedCount = pushResult.count;
      result.errors.push(...pushResult.errors);

      // Pull remote changes to local
      const pullResult = await this.pullChanges(userId, lastSyncTime);
      result.pulledCount = pullResult.count;
      result.conflictCount = pullResult.conflicts;
      result.errors.push(...pullResult.errors);

      // Update last sync time in profile
      await this.profileService.updateLastSync();

      this.lastSyncTimeSignal.set(new Date());
      this.syncStatusSignal.set('success');

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
      return { columns: ['recipeId', 'ingredientId'], onConflict: 'recipe_id,ingredient_id' };
    }
    return { columns: ['id'], onConflict: 'id' };
  }

  /**
   * Get the record identifier string for logging
   */
  private getRecordId(record: any, table: string): string {
    const config = this.getTableKeyConfig(table);
    return config.columns.map(col => record[col]).join(':');
  }

  /**
   * Push local changes to Supabase
   */
  private async pushChanges(
    userId: string,
    lastSyncTime: string
  ): Promise<{ count: number; errors: string[] }> {
    let count = 0;
    const errors: string[] = [];

    for (const table of this.SYNC_TABLES) {
      try {
        // Get local changes since last sync
        const changes = this.db.getChangedRecords(table, lastSyncTime);

        if (changes.length === 0) {
          continue;
        }

        const keyConfig = this.getTableKeyConfig(table);

        // Convert local records to Supabase format
        const records = changes.map((record: any) => {
          const { syncedAt, ...rest } = record; // Remove syncedAt as we'll update it after successful sync
          return {
            ...rest,
            user_id: userId,
            updated_at: new Date().toISOString(),
          };
        });

        // Upsert to Supabase (insert or update)
        const { error } = await this.supabase.from(table).upsert(records, {
          onConflict: keyConfig.onConflict,
          ignoreDuplicates: false,
        });

        if (error) {
          throw error;
        }

        // Mark records as synced in local DB
        const syncTime = new Date().toISOString();
        if (table === 'recipe_ingredients') {
          // Composite key: mark synced by recipeId + ingredientId
          for (const change of changes) {
            this.db.exec(
              `UPDATE recipe_ingredients SET syncedAt = ?, version = version + 1 WHERE recipeId = ? AND ingredientId = ?`,
              [syncTime, change.recipeId, change.ingredientId]
            );
          }
        } else {
          const ids = changes.map((r: any) => r.id);
          this.db.markAsSynced(table, ids, syncTime);
        }

        // Log success
        changes.forEach((r: any) => this.db.logSync(table, 'push', this.getRecordId(r, table), true));

        count += changes.length;
        console.log(`Pushed ${changes.length} changes to ${table}`);
      } catch (error) {
        const errorMsg = `Failed to push ${table}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);

        // Log failure
        this.db.logSync(table, 'push', '', false, errorMsg);
      }
    }

    return { count, errors };
  }

  /**
   * Pull remote changes from Supabase
   */
  private async pullChanges(
    userId: string,
    lastSyncTime: string
  ): Promise<{ count: number; conflicts: number; errors: string[] }> {
    let count = 0;
    let conflicts = 0;
    const errors: string[] = [];

    for (const table of this.SYNC_TABLES) {
      try {
        // Fetch remote changes since last sync
        const { data, error } = await this.supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .gt('updated_at', lastSyncTime);

        if (error) {
          throw error;
        }

        if (!data || data.length === 0) {
          continue;
        }

        // Convert Supabase format to local format
        const records = data.map((record: any) => {
          const { user_id, created_at, updated_at, synced_at, ...rest } = record;
          return {
            ...rest,
            userId: user_id,
            createdAt: created_at,
            updatedAt: updated_at,
            syncedAt: new Date().toISOString(),
          };
        });

        const isCompositeKey = table === 'recipe_ingredients';

        // Build WHERE clause for finding existing records
        const findExistingQuery = isCompositeKey
          ? `SELECT * FROM ${table} WHERE recipeId = ? AND ingredientId = ?`
          : `SELECT * FROM ${table} WHERE id = ?`;

        const getFindParams = (record: any) => isCompositeKey
          ? [record.recipeId, record.ingredientId]
          : [record.id];

        // Check for conflicts (local changes that differ from remote)
        const conflictingRecords: any[] = [];
        const safeRecords: any[] = [];

        for (const remoteRecord of records) {
          const localRecords = this.db.query(findExistingQuery, getFindParams(remoteRecord));

          if (localRecords.length > 0) {
            const localRecord = localRecords[0];

            // Check if local version is newer and different (conflict)
            if (
              localRecord.updatedAt &&
              remoteRecord.updatedAt &&
              localRecord.updatedAt > remoteRecord.updatedAt &&
              localRecord.version !== remoteRecord.version
            ) {
              conflictingRecords.push({
                local: localRecord,
                remote: remoteRecord,
              });
              conflicts++;
              continue;
            }
          }

          safeRecords.push(remoteRecord);
        }

        // Insert/update non-conflicting records
        if (safeRecords.length > 0) {
          const columns = Object.keys(safeRecords[0]);

          for (const record of safeRecords) {
            const placeholders = columns.map(() => '?').join(',');
            const values = columns.map((col) => record[col]);

            // Check if exists
            const existing = this.db.query(findExistingQuery, getFindParams(record));

            if (existing.length > 0) {
              // Update
              const setClause = columns.map((col) => `${col}=?`).join(',');
              if (isCompositeKey) {
                this.db.exec(
                  `UPDATE ${table} SET ${setClause} WHERE recipeId=? AND ingredientId=?`,
                  [...values, record.recipeId, record.ingredientId]
                );
              } else {
                this.db.exec(
                  `UPDATE ${table} SET ${setClause} WHERE id=?`,
                  [...values, record.id]
                );
              }
            } else {
              // Insert
              this.db.exec(
                `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
                values
              );
            }
          }

          count += safeRecords.length;
          console.log(`Pulled ${safeRecords.length} changes from ${table}`);
        }

        // Log conflicts
        if (conflictingRecords.length > 0) {
          console.warn(
            `Found ${conflictingRecords.length} conflicts in ${table}:`,
            conflictingRecords
          );
          conflictingRecords.forEach(({ remote }) =>
            this.db.logSync(table, 'conflict', this.getRecordId(remote, table), false, 'Version conflict')
          );
        }

        // Log success
        safeRecords.forEach((r) => this.db.logSync(table, 'pull', this.getRecordId(r, table), true));
      } catch (error) {
        const errorMsg = `Failed to pull ${table}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);

        // Log failure
        this.db.logSync(table, 'pull', '', false, errorMsg);
      }
    }

    return { count, conflicts, errors };
  }

  /**
   * Start auto-sync (periodic background sync)
   */
  startAutoSync(intervalMinutes: number = 5): void {
    // Check if already syncing
    if ((window as any).__pantrypal_sync_interval) {
      console.log('Auto-sync already running');
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;

    (window as any).__pantrypal_sync_interval = setInterval(async () => {
      if (this.auth.isAuthenticated() && navigator.onLine && !this.isSyncingSignal()) {
        console.log('Auto-sync triggered');
        await this.syncNow();
      }
    }, intervalMs);

    console.log(`Auto-sync started (every ${intervalMinutes} minutes)`);

    // Also sync when coming back online
    window.addEventListener('online', () => {
      if (this.auth.isAuthenticated() && !this.isSyncingSignal()) {
        console.log('Back online - triggering sync');
        this.syncNow();
      }
    });
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if ((window as any).__pantrypal_sync_interval) {
      clearInterval((window as any).__pantrypal_sync_interval);
      (window as any).__pantrypal_sync_interval = null;
      console.log('Auto-sync stopped');
    }
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
