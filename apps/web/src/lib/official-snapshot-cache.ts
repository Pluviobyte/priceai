/**
 * Per-process reuse of public official-price data, which the collector refreshes once a day. After
 * ttlMs a reader still gets the last good snapshot at once while it is refreshed in the background;
 * only a snapshot older than maxStaleMs makes the reader wait. Failed reads are never retained, and
 * they do not discard the last good snapshot either.
 */
export function createOfficialSnapshotCache<T extends { available: boolean; checks: unknown }>(
  read: () => Promise<T>, now = Date.now, ttlMs = 5 * 60_000, maxStaleMs = 60 * 60_000,
): () => Promise<T> {
  let cached: { value: T; loadedAt: number } | undefined;
  let pending: Promise<T> | undefined;
  return () => {
    const time = now();
    if (cached && time - cached.loadedAt < ttlMs) return Promise.resolve(cached.value);
    pending ??= read().then(value => {
      if (value.available && value.checks !== null) cached = { value, loadedAt: now() };
      return value;
    }).finally(() => { pending = undefined; });
    if (cached && time - cached.loadedAt < maxStaleMs) {
      pending.catch(() => undefined);
      return Promise.resolve(cached.value);
    }
    return pending;
  };
}
