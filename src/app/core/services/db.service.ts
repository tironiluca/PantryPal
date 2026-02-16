import { Injectable, inject } from '@angular/core';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { AuthService } from './auth.service';

const DB_FILE = 'pantrypal.db';

@Injectable({ providedIn: 'root' })
export class DbService {
  private auth = inject(AuthService);

  private SQL!: any;
  private db!: any;
  private memOnly = false;

  private mem: Record<string, any[]> = {
    ingredient_categories: [],
    ingredients: [],
    inventory: []
  };

  async init(): Promise<void> {
    try {
      this.SQL = await initSqlJs({ locateFile: (file: string) => new URL(`assets/${file}`, document.baseURI).toString() });
      // this.SQL = await initSqlJs({ locateFile: (file: string) => `assets/${file}` });
      const file = await this.readFromOPFS(DB_FILE);
      this.db = new this.SQL.Database(file ?? undefined);
      this.migrate();
      // seed minimal ingredient to demo
      if (this.query<any>('SELECT * FROM ingredients').length === 0) {
        this.exec("INSERT INTO ingredients (id, name, categoryId) VALUES (?,?,?)", ['ing-eggs', 'Eggs', 'cat-fridge']);
      }
    } catch (e) {
      console.warn('sql.js unavailable, falling back to in-memory store', e);
      this.memOnly = true;
      // seed demo
      this.mem['ingredients'].push({ id: 'ing-eggs', name: 'Eggs', categoryId: 'cat-fridge' });
    }
  }

  private migrate() {
    // Create tables with sync metadata columns
    this.db.run(`
      CREATE TABLE IF NOT EXISTS ingredient_categories (
        id TEXT PRIMARY KEY,
        name TEXT,
        userId TEXT,
        syncedAt TEXT,
        version INTEGER DEFAULT 1,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS ingredients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        categoryId TEXT,
        defaultShelfLifeDays INTEGER,
        notifyStartDays INTEGER,
        notifyRepeatDays INTEGER,
        userId TEXT,
        syncedAt TEXT,
        version INTEGER DEFAULT 1,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        ingredientId TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        minRestock REAL NOT NULL,
        expiry TEXT,
        location TEXT,
        barcode TEXT,
        userId TEXT,
        syncedAt TEXT,
        version INTEGER DEFAULT 1,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        steps TEXT,
        userId TEXT,
        syncedAt TEXT,
        version INTEGER DEFAULT 1,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        recipeId TEXT NOT NULL,
        ingredientId TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        syncedAt TEXT,
        version INTEGER DEFAULT 1,
        isDeleted INTEGER DEFAULT 0,
        PRIMARY KEY (recipeId, ingredientId),
        FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE,
        FOREIGN KEY (ingredientId) REFERENCES ingredients(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS sync_log (
        id TEXT PRIMARY KEY,
        tableName TEXT NOT NULL,
        operation TEXT NOT NULL,
        recordId TEXT,
        timestamp TEXT,
        success INTEGER,
        errorMessage TEXT
      );
    `);

    // Add sync columns to existing tables if they don't exist (migration)
    this.addColumnIfNotExists('ingredient_categories', 'userId', 'TEXT');
    this.addColumnIfNotExists('ingredient_categories', 'syncedAt', 'TEXT');
    this.addColumnIfNotExists('ingredient_categories', 'version', 'INTEGER DEFAULT 1');
    this.addColumnIfNotExists('ingredient_categories', 'isDeleted', 'INTEGER DEFAULT 0');
    this.addColumnIfNotExists('ingredient_categories', 'createdAt', 'TEXT');
    this.addColumnIfNotExists('ingredient_categories', 'updatedAt', 'TEXT');

    this.addColumnIfNotExists('ingredients', 'userId', 'TEXT');
    this.addColumnIfNotExists('ingredients', 'syncedAt', 'TEXT');
    this.addColumnIfNotExists('ingredients', 'version', 'INTEGER DEFAULT 1');
    this.addColumnIfNotExists('ingredients', 'isDeleted', 'INTEGER DEFAULT 0');
    this.addColumnIfNotExists('ingredients', 'createdAt', 'TEXT');
    this.addColumnIfNotExists('ingredients', 'updatedAt', 'TEXT');

    this.addColumnIfNotExists('inventory', 'userId', 'TEXT');
    this.addColumnIfNotExists('inventory', 'syncedAt', 'TEXT');
    this.addColumnIfNotExists('inventory', 'version', 'INTEGER DEFAULT 1');
    this.addColumnIfNotExists('inventory', 'isDeleted', 'INTEGER DEFAULT 0');

    this.addColumnIfNotExists('recipes', 'userId', 'TEXT');
    this.addColumnIfNotExists('recipes', 'syncedAt', 'TEXT');
    this.addColumnIfNotExists('recipes', 'version', 'INTEGER DEFAULT 1');
    this.addColumnIfNotExists('recipes', 'isDeleted', 'INTEGER DEFAULT 0');

    this.addColumnIfNotExists('recipe_ingredients', 'syncedAt', 'TEXT');
    this.addColumnIfNotExists('recipe_ingredients', 'version', 'INTEGER DEFAULT 1');
    this.addColumnIfNotExists('recipe_ingredients', 'isDeleted', 'INTEGER DEFAULT 0');
  }

  /**
   * Add a column to a table if it doesn't already exist
   */
  private addColumnIfNotExists(table: string, column: string, type: string): void {
    try {
      // Check if column exists
      const result = this.db.exec(`PRAGMA table_info(${table})`);

      if (result.length > 0 && result[0].values) {
        const columns = result[0].values.map((row: any[]) => row[1]); // column name is at index 1

        if (!columns.includes(column)) {
          this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
          console.log(`Added column ${column} to ${table}`);
        }
      }
    } catch (error) {
      console.error(`Failed to add column ${column} to ${table}:`, error);
    }
  }

  query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) {
      this.memOnly = true;
    }

    if (this.memOnly) {
      // Extremely simplified parser for our demo list view only
      if (sql.startsWith('SELECT * FROM inventory'))
        return this.mem['inventory'] as any;

      if (sql.startsWith('SELECT * FROM ingredients'))
        return this.mem['ingredients'] as any;

      return [] as any;     // fallthrough to sqlite below

    }

    const stmt = this.db.prepare(sql);

    stmt.bind(params);

    const rows: any[] = [];

    while (stmt.step())
      rows.push(stmt.getAsObject());

    stmt.free();

    return rows as T[];
  }

  exec(sql: string, params: any[] = []) {
    if (!this.db) { this.memOnly = true; }
    if (this.memOnly) {
      // naive handlers for INSERT/UPDATE/DELETE for inventory
      if (sql.startsWith('INSERT INTO inventory')) {
        const rec = {
          id: params[0], ingredientId: params[1], quantity: params[2], unit: params[3],
          minRestock: params[4], expiry: params[5], location: params[6], barcode: params[7],
          createdAt: params[8], updatedAt: params[9]
        };
        this.mem['inventory'].push(rec);
        return;
      }
      if (sql.startsWith('UPDATE inventory')) {
        const id = params[9];
        const idx = this.mem['inventory'].findIndex(r => r.id === id);
        if (idx >= 0) {
          this.mem['inventory'][idx] = {
            ...this.mem['inventory'][idx],
            ingredientId: params[0], quantity: params[1], unit: params[2], minRestock: params[3],
            expiry: params[4], location: params[5], barcode: params[6], updatedAt: params[7]
          };
        }
        return;
      }
      if (sql.startsWith('DELETE FROM inventory')) {
        const id = params[0];
        this.mem['inventory'] = this.mem['inventory'].filter(r => r.id !== id);
        return;
      }
      if (sql.startsWith('INSERT INTO ingredients')) {
        this.mem['ingredients'].push({ id: params[0], name: params[1], categoryId: params[2] });
        return;
      }
      return;
    }
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    return this.persist();
  }

  /**
   * Execute multiple SQL statements in a transaction
   * @param statements Array of SQL statements with their parameters
   * @returns Promise that resolves when all statements are executed and persisted
   */
  execBatch(statements: Array<{ sql: string; params: any[] }>): Promise<void> {
    if (!this.db) {
      this.memOnly = true;
    }

    if (this.memOnly) {
      // Execute each statement individually in memory mode
      statements.forEach(stmt => this.exec(stmt.sql, stmt.params));
      return Promise.resolve();
    }

    try {
      // Start transaction
      this.db.run('BEGIN TRANSACTION');

      // Execute all statements
      for (const stmt of statements) {
        const prepared = this.db.prepare(stmt.sql);
        prepared.bind(stmt.params);
        prepared.step();
        prepared.free();
      }

      // Commit transaction
      this.db.run('COMMIT');

      // Persist once at the end
      return this.persist();
    } catch (error) {
      // Rollback on error
      if (this.db) {
        try {
          this.db.run('ROLLBACK');
        } catch (rollbackError) {
          console.error('Failed to rollback transaction:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Bulk insert rows into a table
   * @param table Table name
   * @param rows Array of row objects
   * @param columns Array of column names
   * @returns Promise that resolves when all rows are inserted
   */
  bulkInsert(table: string, rows: any[], columns: string[]): Promise<void> {
    const statements = rows.map(row => {
      const placeholders = columns.map(() => '?').join(',');
      const values = columns.map(col => row[col] ?? null);

      return {
        sql: `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
        params: values
      };
    });

    return this.execBatch(statements);
  }

  /**
   * Bulk update rows in a table
   * @param table Table name
   * @param rows Array of row objects with id property
   * @param columns Array of column names to update (excluding id)
   * @param idColumn Name of the ID column (default: 'id')
   * @returns Promise that resolves when all rows are updated
   */
  bulkUpdate(table: string, rows: any[], columns: string[], idColumn = 'id'): Promise<void> {
    const statements = rows.map(row => {
      const setClause = columns.map(col => `${col}=?`).join(',');
      const values = [...columns.map(col => row[col] ?? null), row[idColumn]];

      return {
        sql: `UPDATE ${table} SET ${setClause} WHERE ${idColumn}=?`,
        params: values
      };
    });

    return this.execBatch(statements);
  }

  /**
   * Bulk delete rows from a table
   * @param table Table name
   * @param ids Array of IDs to delete
   * @param idColumn Name of the ID column (default: 'id')
   * @returns Promise that resolves when all rows are deleted
   */
  bulkDelete(table: string, ids: string[], idColumn = 'id'): Promise<void> {
    const statements = ids.map(id => ({
      sql: `DELETE FROM ${table} WHERE ${idColumn}=?`,
      params: [id]
    }));

    return this.execBatch(statements);
  }

  async persist() {
    if (this.memOnly) return;
    const data = this.db.export();
    await this.writeToOPFS(DB_FILE, data);
  }

  private async rootDir() { return await (navigator as any).storage.getDirectory(); }
  private async readFromOPFS(name: string): Promise<Uint8Array | null> {
    try {
      const dir = await this.rootDir();
      const handle = await dir.getFileHandle(name, { create: false });
      const file = await handle.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch { return null; }
  }
  private async writeToOPFS(name: string, data: Uint8Array) {
    const dir = await this.rootDir();
    const handle = await dir.getFileHandle(name, { create: true });
    // @ts-ignore
    if ('createSyncAccessHandle' in (handle as any)) {
      // @ts-ignore
      const access = await (handle as any).createSyncAccessHandle();
      await access.truncate(0);
      await access.write(data, { at: 0 });
      await access.flush();
      await access.close();
    } else if ('createWritable' in handle) {
      // @ts-ignore
      const writable = await (handle as any).createWritable();
      await writable.write(data as Uint8Array);
      await writable.close();
    } else {
      // Fallback: localStorage (very small, last resort)
      localStorage.setItem('pp-db', btoa(String.fromCharCode(...data)));
    }
  }

  // ============ Multi-User & Sync Helper Methods ============

  /**
   * Get current user ID from auth service
   */
  getCurrentUserId(): string | null {
    return this.auth.getCurrentUserId();
  }

  /**
   * Query records for the current user (filters by userId automatically)
   * @param table Table name
   * @param whereClause Optional WHERE clause (without userId filter)
   * @param params Query parameters
   * @param includeDeleted Include soft-deleted records (default: false)
   */
  queryByUser<T = any>(
    table: string,
    whereClause: string = '',
    params: any[] = [],
    includeDeleted = false
  ): T[] {
    const userId = this.getCurrentUserId();

    // If no user is logged in, return guest data (userId IS NULL)
    const userFilter = userId ? `userId = ?` : `userId IS NULL`;
    const deletedFilter = includeDeleted ? '' : ` AND (isDeleted IS NULL OR isDeleted = 0)`;

    const where = whereClause
      ? `WHERE ${userFilter} AND ${whereClause}${deletedFilter}`
      : `WHERE ${userFilter}${deletedFilter}`;

    const sql = `SELECT * FROM ${table} ${where}`;
    const finalParams = userId ? [userId, ...params] : params;

    return this.query<T>(sql, finalParams);
  }

  /**
   * Get records that have changed since last sync
   * @param table Table name
   * @param lastSyncTime ISO timestamp of last successful sync
   */
  getChangedRecords<T = any>(table: string, lastSyncTime: string): T[] {
    const userId = this.getCurrentUserId();

    if (!userId) {
      return [];
    }

    const sql = `
      SELECT * FROM ${table}
      WHERE userId = ?
      AND (
        syncedAt IS NULL
        OR updatedAt > ?
        OR (isDeleted = 1 AND updatedAt > ?)
      )
    `;

    return this.query<T>(sql, [userId, lastSyncTime, lastSyncTime]);
  }

  /**
   * Mark records as synced
   * @param table Table name
   * @param ids Record IDs to mark as synced
   * @param syncTime ISO timestamp of sync
   */
  markAsSynced(table: string, ids: string[], syncTime: string): void {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      UPDATE ${table}
      SET syncedAt = ?, version = version + 1
      WHERE id IN (${placeholders})
    `;

    this.exec(sql, [syncTime, ...ids]);
  }

  /**
   * Soft delete a record (sets isDeleted = 1)
   * @param table Table name
   * @param id Record ID
   */
  softDelete(table: string, id: string): void {
    const now = new Date().toISOString();
    const sql = `
      UPDATE ${table}
      SET isDeleted = 1, updatedAt = ?, version = version + 1
      WHERE id = ?
    `;

    this.exec(sql, [now, id]);
  }

  /**
   * Hard delete a record (permanently removes from database)
   * @param table Table name
   * @param id Record ID
   */
  hardDelete(table: string, id: string): void {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    this.exec(sql, [id]);
  }

  /**
   * Update userId for all existing local records (for migration when user first signs in)
   * @param userId User ID to assign
   */
  migrateLocalDataToUser(userId: string): void {
    const tables = ['ingredient_categories', 'ingredients', 'inventory', 'recipes'];

    const statements = tables.flatMap(table => {
      // Update records with NULL userId to the new userId
      return [{
        sql: `UPDATE ${table} SET userId = ? WHERE userId IS NULL OR userId = ''`,
        params: [userId]
      }];
    });

    this.execBatch(statements);
    console.log(`Migrated local data to user ${userId}`);
  }

  /**
   * Get sync statistics for monitoring
   */
  getSyncStats(): {
    unsyncedCount: number;
    lastSyncTime: string | null;
    tables: Record<string, { total: number; unsynced: number; deleted: number }>;
  } {
    const userId = this.getCurrentUserId();

    if (!userId) {
      return {
        unsyncedCount: 0,
        lastSyncTime: null,
        tables: {}
      };
    }

    const tables = ['ingredient_categories', 'ingredients', 'inventory', 'recipes'];
    const stats: Record<string, { total: number; unsynced: number; deleted: number }> = {};
    let totalUnsynced = 0;

    for (const table of tables) {
      const total = this.query<any>(
        `SELECT COUNT(*) as count FROM ${table} WHERE userId = ? AND (isDeleted IS NULL OR isDeleted = 0)`,
        [userId]
      )[0]?.count || 0;

      const unsynced = this.query<any>(
        `SELECT COUNT(*) as count FROM ${table} WHERE userId = ? AND (syncedAt IS NULL OR updatedAt > syncedAt)`,
        [userId]
      )[0]?.count || 0;

      const deleted = this.query<any>(
        `SELECT COUNT(*) as count FROM ${table} WHERE userId = ? AND isDeleted = 1`,
        [userId]
      )[0]?.count || 0;

      stats[table] = { total, unsynced, deleted };
      totalUnsynced += unsynced;
    }

    // Get last sync time from most recent syncedAt
    const lastSyncResult = this.query<any>(
      `SELECT MAX(syncedAt) as lastSync FROM (
        SELECT syncedAt FROM ingredient_categories WHERE userId = ? AND syncedAt IS NOT NULL
        UNION ALL
        SELECT syncedAt FROM ingredients WHERE userId = ? AND syncedAt IS NOT NULL
        UNION ALL
        SELECT syncedAt FROM inventory WHERE userId = ? AND syncedAt IS NOT NULL
        UNION ALL
        SELECT syncedAt FROM recipes WHERE userId = ? AND syncedAt IS NOT NULL
      )`,
      [userId, userId, userId, userId]
    );

    return {
      unsyncedCount: totalUnsynced,
      lastSyncTime: lastSyncResult[0]?.lastSync || null,
      tables: stats
    };
  }

  /**
   * Log sync operation for debugging
   */
  logSync(tableName: string, operation: 'push' | 'pull' | 'conflict', recordId: string, success: boolean, errorMessage?: string): void {
    const id = `sync-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = new Date().toISOString();

    const sql = `
      INSERT INTO sync_log (id, tableName, operation, recordId, timestamp, success, errorMessage)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    this.exec(sql, [id, tableName, operation, recordId, timestamp, success ? 1 : 0, errorMessage || null]);
  }
}
