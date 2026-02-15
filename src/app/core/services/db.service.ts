import { Injectable } from '@angular/core';
import initSqlJs from 'sql.js/dist/sql-wasm.js';

const DB_FILE = 'pantrypal.db';

@Injectable({ providedIn: 'root' })
export class DbService {
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
    this.db.run(`
      CREATE TABLE IF NOT EXISTS ingredient_categories (id TEXT PRIMARY KEY, name TEXT);
      CREATE TABLE IF NOT EXISTS ingredients (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, categoryId TEXT,
        defaultShelfLifeDays INTEGER, notifyStartDays INTEGER, notifyRepeatDays INTEGER
      );
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY, ingredientId TEXT NOT NULL, quantity REAL NOT NULL,
        unit TEXT NOT NULL, minRestock REAL NOT NULL, expiry TEXT, location TEXT, barcode TEXT,
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        steps TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        recipeId TEXT NOT NULL,
        ingredientId TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        PRIMARY KEY (recipeId, ingredientId),
        FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE,
        FOREIGN KEY (ingredientId) REFERENCES ingredients(id) ON DELETE RESTRICT
      );
    `);
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
}
