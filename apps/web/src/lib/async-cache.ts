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
    stats: () => ({ ...counters, size: values.size, pending: pending.size }),
    delete(key) { values.delete(key); },
    clear() { values.clear(); pending.clear(); },
  };
}
