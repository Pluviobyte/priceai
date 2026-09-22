import type { QueryResultRow } from "pg";
import { query } from "./database";

export interface PublicationPointer extends QueryResultRow {
  generation_id: string | null;
  published_at: Date | null;
}

export async function getPublicationPointer(
  channel = "card_prices",
  read: typeof query = query,
): Promise<PublicationPointer | null> {
  const [row] = await read<PublicationPointer>(
    `select pc.current_generation_id::text generation_id,pg.published_at
       from publication_channels pc
       left join publish_generations pg on pg.id=pc.current_generation_id
      where pc.channel=$1 limit 1`,
    [channel],
  );
  return row ?? null;
}
