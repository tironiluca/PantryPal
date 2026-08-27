import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let db: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = new CacheService();
    db = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getAll: vi.fn(),
    };
    (service as any).db = db;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns cached data and null for a cache miss', async () => {
    db.get.mockResolvedValueOnce({ barcode: 'milk', data: { name: 'Milk' }, timestamp: 9_000 });
    db.get.mockResolvedValueOnce(undefined);

    await expect(service.get('milk', 2_000)).resolves.toEqual({ name: 'Milk' });
    await expect(service.get('missing')).resolves.toBeNull();
  });

  it('deletes and returns null for expired entries', async () => {
    db.get.mockResolvedValue({ barcode: 'milk', data: { name: 'Milk' }, timestamp: 1_000 });

    await expect(service.get('milk', 2_000)).resolves.toBeNull();
    expect(db.delete).toHaveBeenCalledWith('products', 'milk');
  });

  it('writes, clears, and reports cache statistics', async () => {
    await service.set('milk', { name: 'Milk' });
    expect(db.put).toHaveBeenCalledWith('products', {
      barcode: 'milk',
      data: { name: 'Milk' },
      timestamp: 10_000,
    });

    db.getAll.mockResolvedValue([{ timestamp: 8_000 }, { timestamp: 12_000 }]);
    await expect(service.getStats()).resolves.toEqual({ count: 2, oldestEntry: 8_000 });

    await service.clear();
    expect(db.clear).toHaveBeenCalledWith('products');
    await service.delete('milk');
    expect(db.delete).toHaveBeenCalledWith('products', 'milk');
  });

  it('returns safe fallback values when cache operations fail', async () => {
    db.get.mockRejectedValue(new Error('read failed'));
    db.put.mockRejectedValue(new Error('write failed'));
    db.getAll.mockRejectedValue(new Error('stats failed'));

    await expect(service.get('milk')).resolves.toBeNull();
    await expect(service.set('milk', {})).resolves.toBeUndefined();
    await expect(service.getStats()).resolves.toEqual({ count: 0, oldestEntry: null });
  });
});
