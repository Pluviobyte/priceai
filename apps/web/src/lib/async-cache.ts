export interface AsyncCacheStats {
  hits: number;
  misses: number;
  coalesced: number;
  evictions: number;
  size: number;
  pending: number;
}

export class AsyncCacheCapacityError extends Error {
  constructor() { super("async_cache_capacity_exceeded"); }
}

export interface AsyncCache<Key, Value> {
  get(key: Key, load: () => Promise<Value>): Promise<Value>;
  /** The unexpired value for key, without loading or touching the counters. */
  peek(key: Key): Value | undefined;
  stats(): AsyncCacheStats;
  delete(key: Key): void;
  clear(): void;
}

/**
 * Small process-local cache for published, read-only data. Concurrent misses for
 * the same key share one promise; rejected reads are never retained.
 */
export function createAsyncCache<Key, Value>(options: {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
  shouldCache?: (value: Value) => boolean;
  maxPending?: number;
}): AsyncCache<Key, Value> {
  const now = options.now ?? Date.now;
  const values = new Map<Key, { value: Value; expires: number }>();
  const pending = new Map<Key, Promise<Value>>();
  const counters = { hits: 0, misses: 0, coalesced: 0, evictions: 0 };

  const prune = (time: number) => {
    for (const [key, entry] of values) if (entry.expires <= time) values.delete(key);
    while (values.size >= options.maxEntries) {
      const oldest = values.keys().next().value as Key | undefined;
      if (oldest === undefined) break;
      values.delete(oldest);
      counters.evictions++;
    }
  };

  return {
    get(key, load) {
      const time = now();
      const cached = values.get(key);
      if (cached && cached.expires > time) {
        counters.hits++;
        // Refresh insertion order so the bound behaves as a small LRU.
        values.delete(key);
        values.set(key, cached);
        return Promise.resolve(cached.value);
      }
      const existing = pending.get(key);
      if (existing) {
        counters.coalesced++;
        return existing;
      }
      if (pending.size >= (options.maxPending ?? options.maxEntries)) {
        return Promise.reject(new AsyncCacheCapacityError());
      }
      counters.misses++;
      const promise = load().then(value => {
        if (options.shouldCache?.(value) !== false) {
          prune(now());
          values.set(key, { value, expires: now() + options.ttlMs });
        }
        return value;
      }).finally(() => pending.delete(key));
      pending.set(key, promise);
      return promise;
    },
    peek(key) {
      const cached = values.get(key);
      return cached && cached.expires > now() ? cached.value : undefined;
    },
    stats: () => ({ ...counters, size: values.size, pending: pending.size }),
    delete(key) { values.delete(key); },
    clear() { values.clear(); pending.clear(); },
  };
}

export interface StaleWhileRevalidateResult<Key, Value> { key: Key; value: Value; stale: boolean }

export interface StaleWhileRevalidate<Key, Value> {
  get(key: Key, load: () => Promise<Value>): Promise<StaleWhileRevalidateResult<Key, Value>>;
  stats(): { staleServed: number; backgroundFailures: number };
}

/**
 * Answers a key that is not loaded yet with the newest value already served for another key, and lets
 * the load finish in the background. Meant for publication-scoped data: every publication is a new key,
 * and the previous publication stays a complete, consistent answer until the next one is ready. Without
 * this, the first visitor after each publication waits for the whole read. The fallback is used only
 * while it was last served within maxStaleMs; older than that, the reader waits for the load.
 */
export function createStaleWhileRevalidate<Key, Value>(cache: AsyncCache<Key, Value>, options: {
  maxStaleMs: number;
  now?: () => number;
  /** Values that should not answer later keys, such as a degraded read. */
  keep?: (value: Value) => boolean;
  onBackgroundError?: (error: unknown) => void;
}): StaleWhileRevalidate<Key, Value> {
  const now = options.now ?? Date.now;
  let latest: { key: Key; value: Value; servedAt: number } | undefined;
  const counters = { staleServed: 0, backgroundFailures: 0 };
  return {
    get(key, load) {
      const ready = cache.peek(key) !== undefined;
      const loading = cache.get(key, load).then(value => {
        if (options.keep?.(value) !== false) latest = { key, value, servedAt: now() };
        return value;
      });
      const fallback = latest;
      if (!ready && fallback && fallback.key !== key && now() - fallback.servedAt <= options.maxStaleMs) {
        counters.staleServed++;
        loading.catch(error => { counters.backgroundFailures++; options.onBackgroundError?.(error); });
        return Promise.resolve({ key: fallback.key, value: fallback.value, stale: true });
      }
      return loading.then(value => ({ key, value, stale: false }));
    },
    stats: () => ({ ...counters }),
  };
}
