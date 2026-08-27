import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { CacheService } from './cache.service';

interface OFFResponse { status: number; product?: any; }

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private cache = inject(CacheService);
  private http = inject(HttpClient);
  private cacheReady: Promise<void>;

  constructor() {
    this.cacheReady = this.cache.init();
  }

  /**
   * Fetch product information by barcode
   * Checks cache first, then falls back to API call
   * @param barcode The product barcode
   * @returns Observable of product data
   */
  byBarcode(barcode: string): Observable<OFFResponse> {
    return from(this.cacheReady).pipe(
      switchMap(() => from(this.cache.get(barcode))),
      switchMap(cached => {
        // Return cached data if available
        if (cached) {
          console.log(`[ProductsService] Using cached data for barcode: ${barcode}`);
          return of(cached as OFFResponse);
        }

        // Fetch from API
        console.log(`[ProductsService] Fetching from API for barcode: ${barcode}`);
        return this.http
          .get<OFFResponse>(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
          .pipe(
            tap(response => {
              // Cache successful responses
              if (response.status === 1) {
                this.cache.set(barcode, response);
                console.log(`[ProductsService] Cached data for barcode: ${barcode}`);
              }
            })
          );
      })
    );
  }

  /**
   * Search products by name using Open Food Facts search API
   */
  searchByName(name: string): Observable<any> {
    const encoded = encodeURIComponent(name.trim());
    return this.http.get<any>(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}&json=true&page_size=5&fields=product_name,generic_name,nutriments,brands`
    );
  }

  /**
   * Clear product cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ count: number; oldestEntry: number | null }> {
    return this.cache.getStats();
  }
}
