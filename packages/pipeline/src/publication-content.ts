import { createHash } from 'node:crypto';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}

/** Business state only: callers deliberately exclude observation clocks and raw row IDs. */
export function offerContentHash(value: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export function catalogContentHash(offerHashes: readonly string[]): string {
  return createHash('sha256').update('priceai-business-catalog-v1\n')
    .update([...offerHashes].sort().join('\n')).digest('hex');
}
