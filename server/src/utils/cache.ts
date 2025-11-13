/**
 * Simple in-memory cache utility
 * TTL (Time To Live) based expiration
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, value: T, ttlSeconds: number = 60): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new SimpleCache();

// Clean up expired entries every 5 minutes
setInterval(() => {
  cache.cleanup();
}, 5 * 60 * 1000);

