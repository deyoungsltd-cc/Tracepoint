// ============================================================
// TRACEPOINT — In-Memory API Response Cache
// Reduces redundant API calls for the same phone/email within a time window.
// Serverless-safe (no Redis needed for MVP).
// ============================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_SIZE = 500;
let evictionCount = 0;

/**
 * Get a cached value.
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  entry.hits++;
  return entry.data as T;
}

/**
 * Set a cached value with optional TTL.
 */
export function setCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    evictOldest(Math.ceil(MAX_CACHE_SIZE * 0.2)); // Evict 20%
  }

  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
    hits: 0,
  });
}

/**
 * Wrap an async function with caching.
 * If a cached result exists and is fresh, return it.
 * Otherwise, call the function and cache the result.
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs?: number
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return cached;

  const result = await fn();
  setCache(key, result, ttlMs);
  return result;
}

/**
 * Generate a cache key from arguments.
 */
export function cacheKey(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter(p => p != null)
    .map(String)
    .join(':');
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): { size: number; hits: number; evictions: number } {
  let totalHits = 0;
  for (const entry of cache.values()) {
    totalHits += entry.hits;
  }
  return {
    size: cache.size,
    hits: totalHits,
    evictions: evictionCount,
  };
}

/**
 * Clear all cache entries.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Invalidate entries matching a prefix.
 */
export function invalidateByPrefix(prefix: string): number {
  let count = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      count++;
    }
  }
  return count;
}

// TTL presets for different data types
export const TTL = {
  PHONE_VALIDATION: 30 * 60 * 1000,  // 30 min — phone validity doesn't change often
  WEB_SEARCH: 10 * 60 * 1000,         // 10 min — web content changes frequently
  AI_ANALYSIS: 60 * 60 * 1000,         // 1 hour — AI results are stable for same evidence
  SOCIAL_PROFILE: 60 * 60 * 1000,      // 1 hour — profiles change slowly
  MESSAGING_CHECK: 15 * 60 * 1000,     // 15 min — registration status is stable
  TWILIO_LOOKUP: 30 * 60 * 1000,       // 30 min
  LOCATION: 5 * 60 * 1000,             // 5 min — locations change frequently
} as const;

function evictOldest(count: number): void {
  const entries = Array.from(cache.entries())
    .sort((a, b) => a[1].createdAt - b[1].createdAt);

  for (let i = 0; i < Math.min(count, entries.length); i++) {
    cache.delete(entries[i][0]);
    evictionCount++;
  }
}
