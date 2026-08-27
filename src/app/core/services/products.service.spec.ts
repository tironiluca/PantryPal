import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { CacheService } from './cache.service';
import { ProductsService } from './products.service';
import { HttpClient } from '@angular/common/http';

describe('ProductsService', () => {
  it('waits for cache initialization before reading or fetching a product', async () => {
    let resolveInit!: () => void;
    const cacheInit = new Promise<void>(resolve => {
      resolveInit = resolve;
    });
    const cache = {
      init: vi.fn(() => cacheInit),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
    };
    const http = {
      get: vi.fn().mockReturnValue(of({ status: 0 })),
    };

    TestBed.configureTestingModule({
      providers: [
        ProductsService,
        { provide: CacheService, useValue: cache },
        { provide: HttpClient, useValue: http },
      ],
    });

    const service = TestBed.inject(ProductsService);
    const lookup = firstValueFrom(service.byBarcode('0123456789012'));

    expect(cache.get).not.toHaveBeenCalled();
    resolveInit();
    await lookup;

    expect(cache.get).toHaveBeenCalledWith('0123456789012');
  });
});