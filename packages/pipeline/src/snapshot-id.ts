import { sql } from 'drizzle-orm';

/** UUIDv7 (RFC 9562 §5.7) for new snapshot rows on PostgreSQL 17.
 * Keep the publication's 48-bit millisecond timestamp and 74 fresh random bits
 * per row from gen_random_uuid(), including its RFC variant. Nearby IDs avoid
 * random reads across the historical primary-key index. No legacy IDs change.
 * IDs within a millisecond are random, not strictly monotonic.
 */
export function snapshotIdSql(at: Date) {
  const milliseconds = at.getTime();
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > 0xffffffffffff) {
    throw new Error('invalid_snapshot_id_timestamp');
  }
  const hex = milliseconds.toString(16).padStart(12, '0');
  const prefix = `${hex.slice(0, 8)}-${hex.slice(8)}-7`;
  return sql`(${prefix} || substring(gen_random_uuid()::text from 16))::uuid`;
}
