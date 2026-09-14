/** Short, per-process reuse of public data. Failed reads are never retained. */
export function createOfficialSnapshotCache<T extends { available: boolean; checks: unknown }>(
  read: () => Promise<T>, now = Date.now, ttlMs = 30_000,
): () => Promise<T> {
  let cached: { value: T; expires: number } | undefined;
  let pending: Promise<T> | undefined;
  return () => {
    if (cached && now() < cached.expires) return Promise.resolve(cached.value);
    if (pending) return pending;
    pending = read().then(value => {
      cached = value.available && value.checks !== null ? { value, expires: now() + ttlMs } : undefined;
      return value;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}
