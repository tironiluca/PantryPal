import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { DbService } from './db.service';
import { SyncService } from './sync.service';
import { SnackbarService } from './snackbar.service';

@Injectable({
  providedIn: 'root',
})
export class MigrationService {
  private auth = inject(AuthService);
  private db = inject(DbService);
  private sync = inject(SyncService);
  private snackbar = inject(SnackbarService);

  private migrationKey = 'pantrypal_migration_status';

  /**
   * Check if migration is needed and perform it
   * Should be called on app initialization when user is authenticated
   */
  async checkAndMigrate(): Promise<void> {
    const userId = this.auth.getCurrentUserId();

    if (!userId) {
      // Not authenticated, skip migration
      return;
    }

    // Check if migration already done for this user
    const migrationStatus = this.getMigrationStatus(userId);

    if (migrationStatus.completed) {
      console.log('Migration already completed for this user');
      return;
    }

    // Check if there's local data to migrate
    const hasLocalData = this.hasUnmigratedData();

    if (!hasLocalData) {
      console.log('No local data to migrate');
      this.markMigrationComplete(userId);
      return;
    }

    // Perform migration
    await this.performMigration(userId);
  }

  /**
   * Check if there's local data that hasn't been migrated
   */
  private hasUnmigratedData(): boolean {
    const tables = ['ingredient_categories', 'ingredients', 'inventory', 'recipes', 'recipe_ingredients', 'meal_plans'];

    for (const table of tables) {
      const records = this.db.query<any>(
        `SELECT COUNT(*) as count FROM ${table} WHERE userId IS NULL OR userId = ''`
      );

      if (records.length > 0 && records[0].count > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Perform the migration of local data to user account
   */
  private async performMigration(userId: string): Promise<void> {
    try {
      console.log('Starting data migration for user:', userId);

      // Show notification to user
      this.snackbar.info('Migrating your local data to your account...');

      // Count records before migration
      const beforeCounts = this.getRecordCounts();
      const totalRecords = Object.values(beforeCounts).reduce((sum, count) => sum + count, 0);

      if (totalRecords === 0) {
        console.log('No records to migrate');
        this.markMigrationComplete(userId);
        return;
      }

      // Perform migration using DbService
      this.db.migrateLocalDataToUser(userId);

      // Verify migration
      const afterCounts = this.getRecordCounts();

      console.log('Migration complete:', {
        before: beforeCounts,
        after: afterCounts,
        totalMigrated: totalRecords,
      });

      // Mark migration as complete
      this.markMigrationComplete(userId);

      // Show success message
      this.snackbar.success(
        `${totalRecords} item${totalRecords > 1 ? 's' : ''} migrated to your account!`
      );

      // Trigger initial sync to push migrated data to cloud
      setTimeout(async () => {
        console.log('Triggering initial sync after migration...');
        await this.sync.syncNow();
      }, 1000);
    } catch (error) {
      console.error('Migration failed:', error);
      this.snackbar.error('Failed to migrate local data. Please contact support.');
    }
  }

  /**
   * Get count of unmigrated records per table
   */
  private getRecordCounts(): Record<string, number> {
    const tables = ['ingredient_categories', 'ingredients', 'inventory', 'recipes', 'recipe_ingredients', 'meal_plans'];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      const result = this.db.query<any>(
        `SELECT COUNT(*) as count FROM ${table} WHERE userId IS NULL OR userId = ''`
      );
      counts[table] = result.length > 0 ? result[0].count : 0;
    }

    return counts;
  }

  /**
   * Get migration status for a user
   */
  private getMigrationStatus(userId: string): { completed: boolean; timestamp?: string } {
    const statusJson = localStorage.getItem(this.migrationKey);

    if (!statusJson) {
      return { completed: false };
    }

    try {
      const status = JSON.parse(statusJson);
      return status[userId] || { completed: false };
    } catch {
      return { completed: false };
    }
  }

  /**
   * Mark migration as complete for a user
   */
  private markMigrationComplete(userId: string): void {
    const statusJson = localStorage.getItem(this.migrationKey);
    let status: Record<string, any> = {};

    if (statusJson) {
      try {
        status = JSON.parse(statusJson);
      } catch {
        status = {};
      }
    }

    status[userId] = {
      completed: true,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem(this.migrationKey, JSON.stringify(status));
    console.log('Migration marked as complete for user:', userId);
  }

  /**
   * Reset migration status (for testing)
   */
  resetMigrationStatus(userId?: string): void {
    if (userId) {
      const statusJson = localStorage.getItem(this.migrationKey);
      if (statusJson) {
        try {
          const status = JSON.parse(statusJson);
          delete status[userId];
          localStorage.setItem(this.migrationKey, JSON.stringify(status));
        } catch {
          // Ignore
        }
      }
    } else {
      localStorage.removeItem(this.migrationKey);
    }
    console.log('Migration status reset');
  }

  /**
   * Force migration (for testing or manual trigger)
   */
  async forceMigration(): Promise<void> {
    const userId = this.auth.getCurrentUserId();

    if (!userId) {
      this.snackbar.error('Please sign in first');
      return;
    }

    // Reset migration status
    this.resetMigrationStatus(userId);

    // Perform migration
    await this.performMigration(userId);
  }
}
