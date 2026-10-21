import type { QueryResultRow } from "pg";
import { query } from "./database";

export interface PublicationPointer extends QueryResultRow {
  generation_id: string | null;
  published_at: Date | null;
  refreshed_at?: Date | null;
}

export async function getPublicationPointer(
  channel = "card_prices",
  read: typeof query = query,
): Promise<PublicationPointer | null> {
  const [row] = await read<PublicationPointer>(
    `select pc.current_generation_id::text generation_id,pg.published_at,pc.updated_at as refreshed_at
       from publication_channels pc
       left join publish_generations pg on pg.id=pc.current_generation_id
      where pc.channel=$1 limit 1`,
    [channel],
  );
  return row ?? null;
}

/** Live rows can change while the immutable snapshot pointer stays the same. */
export function publicationCacheKey(pointer: { generation_id: string | null; refreshed_at?: Date | string | null } | null) {
  const generation = pointer?.generation_id ?? "none";
  return pointer?.refreshed_at ? `${generation}:${new Date(pointer.refreshed_at).toISOString()}` : generation;
}
