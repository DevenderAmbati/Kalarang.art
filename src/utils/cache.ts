/**
 * Simple in-memory cache with TTL (Time To Live) support
 * Implements stale-while-revalidate pattern
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTime: number;
  cacheTime: number;
}

class Cache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Set cache entry with stale time and cache time
   * @param key - Cache key
   * @param data - Data to cache
   * @param staleTime - Time in ms before data is considered stale (default: 5 minutes)
   * @param cacheTime - Time in ms before data is removed from cache (default: 10 minutes)
   */
  set<T>(
    key: string,
    data: T,
    staleTime: number = 5 * 60 * 1000,
    cacheTime: number = 10 * 60 * 1000
  ): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      staleTime,
      cacheTime,
    });
  }

  /**
   * Get cache entry
   * @param key - Cache key
   * @returns Object with data and isStale flag
   */
  get<T>(key: string): { data: T | null; isStale: boolean; exists: boolean } {
    const entry = this.cache.get(key);

    if (!entry) {
      return { data: null, isStale: true, exists: false };
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if data should be removed from cache
    if (age > entry.cacheTime) {
      this.cache.delete(key);
      return { data: null, isStale: true, exists: false };
    }

    // Check if data is stale but still in cache
    const isStale = age > entry.staleTime;

    return {
      data: entry.data,
      isStale,
      exists: true,
    };
  }

  /**
   * Check if key exists and is not stale
   */
  has(key: string): boolean {
    const result = this.get(key);
    return result.exists && !result.isStale;
  }

  /**
   * Invalidate (remove) cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      const age = now - entry.timestamp;
      if (age > entry.cacheTime) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    keys: string[];
    entries: Array<{ key: string; age: number; isStale: boolean }>;
  } {
    const now = Date.now();
    const entries: Array<{ key: string; age: number; isStale: boolean }> = [];

    this.cache.forEach((entry, key) => {
      const age = now - entry.timestamp;
      const isStale = age > entry.staleTime;
      entries.push({ key, age, isStale });
    });

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      entries,
    };
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Export singleton instance
export const cache = new Cache();

/**
 * Cache key generators
 */
export const cacheKeys = {
  artworks: (limit?: number) => `artworks${limit ? `-${limit}` : ''}`,
  discoverPaginated: () => `discover-paginated`,
  homeFeedPaginated: (userId?: string) => userId ? `homefeed-paginated-${userId}` : `homefeed-paginated`,
  stories: (userId?: string) => userId ? `stories-${userId}` : `stories`,
  artwork: (id: string) => `artwork-${id}`,
  favorites: (userId: string) => `favorites-${userId}`,
  favoriteArtworks: (userId: string) => `favorite-artworks-${userId}`,
  userProfile: (userId: string) => `user-${userId}`,
  artistWorks: (userId: string) => `artist-works-${userId}`,
  publishedWorks: (userId: string) => `published-works-${userId}`,
  galleryWorks: (userId: string) => `gallery-works-${userId}`,
};

/**
 * Default cache times
 */
export const cacheTimes = {
  // Data is fresh for 2 minutes, stays in cache for 5 minutes
  artworks: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
  },
  // Individual artwork is fresh for 5 minutes, stays in cache for 10 minutes
  artwork: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  },
  // Favorites are fresh for 1 minute, stays in cache for 3 minutes
  favorites: {
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 3 * 60 * 1000, // 3 minutes
  },
  // User profile is fresh for 5 minutes, stays in cache for 15 minutes
  userProfile: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
  },
  // Portfolio artworks are fresh for 3 minutes, stays in cache for 10 minutes
  portfolio: {
    staleTime: 3 * 60 * 1000, // 3 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  },
};
