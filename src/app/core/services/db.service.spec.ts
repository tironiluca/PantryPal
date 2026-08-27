import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { DB_TABLE_COLUMNS, DbService } from './db.service';

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
});