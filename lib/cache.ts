/**
 * Simple TTL-based in-memory cache for server-side use.
 *
 * Usage:
 *   import { serverCache } from '@/lib/cache';
 *
 *   // Get or set with factory
 *   const settings = await serverCache.getOrSet('settings', () => fetchSettings(), 60);
 *
 *   // Invalidate on mutation
 *   serverCache.invalidate('settings');
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number; // Unix ms
}

class ServerCache {
    private store = new Map<string, CacheEntry<any>>();

    /** Get a cached value. Returns null if missing or expired. */
    get<T>(key: string): T | null {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.value as T;
    }

    /** Set a value with TTL in seconds. */
    set<T>(key: string, value: T, ttlSeconds: number): void {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    }

    /**
     * Get from cache or call factory to populate.
     * Negative ttl means "cache forever" (not recommended).
     */
    async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds: number): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== null) return cached;

        const value = await factory();
        this.set(key, value, ttlSeconds);
        return value;
    }

    /** Remove a single key. */
    invalidate(key: string): void {
        this.store.delete(key);
    }

    /** Remove all keys matching prefix. */
    invalidatePrefix(prefix: string): void {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }

    /** Clear all cached values. */
    invalidateAll(): void {
        this.store.clear();
    }

    /** Cleanup expired entries (call periodically if needed). */
    prune(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }
}

// Singleton — shared across all API routes in the same Node.js process
// On serverless (Vercel), each function invocation may have its own instance,
// but it still avoids redundant DB calls within the same request lifecycle.
declare global {
    var __serverCache: ServerCache | undefined;
}

export const serverCache: ServerCache = global.__serverCache ?? (global.__serverCache = new ServerCache());

// Cache TTL constants (seconds)
export const CACHE_TTL = {
    SETTINGS: 60,       // Settings rarely change
    SERVICES: 30,       // Services update occasionally
    PRODUCTS: 30,
    STAFF: 60,
    ROLES: 300,         // Roles almost never change
} as const;

export default serverCache;
