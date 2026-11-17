import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { AuthService } from './auth.service';
import { DbService } from './db.service';

/**
 * Sync uploads every local column (except syncedAt) of a changed row. A local column that the
 * Supabase table lacks makes PostgREST reject the whole upsert, so that table never syncs.
 * This checks the local SQLite schema against the server schema the migrations produce.
 */
const SYNC_TABLES = ['ingredient_categories', 'ingredients', 'inventory', 'recipes', 'recipe_ingredients', 'meal_plans'];

function serverColumns(...files: string[]): Record<string, Set<string>> {
  const tables: Record<string, Set<string>> = {};
  for (const file of files) {
    const sql = readFileSync(`${process.cwd()}/${file}`, 'utf8');
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+) \(([\s\S]*?)\n\);/g)) {
      const cols = m[2].split('\n').map(l => l.trim())
        .filter(l => l && !l.startsWith('--') && !/^(PRIMARY|UNIQUE|CONSTRAINT|FOREIGN)/i.test(l))
        .map(l => l.split(/\s+/)[0]);
      tables[m[1]] = new Set([...(tables[m[1]] ?? []), ...cols]);
    }
    for (const m of sql.matchAll(/ALTER TABLE (?:public\.)?(\w+) ADD COLUMN IF NOT EXISTS (\w+)/g)) {
      (tables[m[1]] ??= new Set()).add(m[2]);
    }
  }
  return tables;
}

describe('local and server sync schemas', () => {
  let localColumns: Record<string, string[]>;

  beforeAll(async () => {
    const SQL = await initSqlJs({ locateFile: (file: string) => `${process.cwd()}/node_modules/sql.js/dist/${file}` });
    TestBed.configureTestingModule({ providers: [DbService, { provide: AuthService, useValue: { getCurrentUserId: () => null } }] });
    const service = TestBed.inject(DbService) as any;
    service.db = new SQL.Database();
    service.migrate();
    localColumns = {};
    for (const table of SYNC_TABLES) {
      localColumns[table] = service.query(`PRAGMA table_info(${table})`).map((c: any) => c.name);
    }
  });

  const pushedColumns = (table: string) =>
    localColumns[table]
      .filter(c => c !== 'syncedAt' && !(table === 'recipe_ingredients' && c === 'userId'))
      .map(c => c.replace(/([A-Z])/g, m => `_${m.toLowerCase()}`));

  for (const [name, files] of [
    ['migrations 001-004', ['supabase/migrations/001_initial_schema.sql', 'supabase/migrations/004_household_rpcs_and_account_deletion.sql']],
    ['legacy setup schema + 004', ['supabase/tests/fixtures/legacy_setup_schema.sql', 'supabase/migrations/004_household_rpcs_and_account_deletion.sql']],
  ] as const) {
    it(`every pushed column exists on the server (${name})`, () => {
      const server = serverColumns(...files);
      const missing = SYNC_TABLES.flatMap(table =>
        pushedColumns(table).filter(c => !server[table]?.has(c)).map(c => `${table}.${c}`));
      expect(missing).toEqual([]);
    });
  }
});
