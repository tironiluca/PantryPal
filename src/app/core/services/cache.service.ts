import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface CacheSchema extends DBSchema {
  products: {
    key: string;
    value: {
      barcode: string;
      data: any;
      timestamp: number;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class CacheService {
  private db: IDBPDatabase<CacheSchema> | null = null;
  private readonly DB_NAME = 'pantrypal-cache';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    try {
      this.db = await openDB<CacheSchema>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Create object store for products
          if (!db.objectStoreNames.contains('products')) {
            db.createObjectStore('products', { keyPath: 'barcode' });
          }
        },
      });
    } catch (error) {
      console.error('Failed to initialize cache database:', error);
      this.db = null;
    }
  }

  /**
   * Get cached data for a key
   * @param key The cache key
   * @param maxAge Maximum age in milliseconds (default: 24 hours)
   * @returns Cached data or null if not found/expired
   */
  async get(key: string, maxAge = 86400000): Promise<any | null> {
    if (!this.db) {
      await this.init();
      if (!this.db) return null;
    }

    try {
      const entry = await this.db.get('products', key);
      if (!entry) return null;

      // Check if expired
      if (Date.now() - entry.timestamp > maxAge) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Set cached data for a key
   * @param key The cache key
   * @param data The data to cache
   */
  async set(key: string, data: any): Promise<void> {
    if (!this.db) {
      await this.init();
      if (!this.db) return;
    }

    try {
      await this.db.put('products', {
        barcode: key,
        data,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to set cached data:', error);
    }
  }

  /**
   * Delete cached data for a key
   * @param key The cache key
   */
  async delete(key: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.delete('products', key);
    } catch (error) {
      console.error('Failed to delete cached data:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.clear('products');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ count: number; oldestEntry: number | null }> {
    if (!this.db) {
      await this.init();
      if (!this.db) return { count: 0, oldestEntry: null };
    }

    try {
      const all = await this.db.getAll('products');
      const count = all.length;
      const oldestEntry = all.length > 0
        ? Math.min(...all.map(e => e.timestamp))
        : null;

      return { count, oldestEntry };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { count: 0, oldestEntry: null };
    }
  }
}
