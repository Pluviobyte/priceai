import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { sources, type Database } from "@price-radar/database";

export interface DueSource {
  id: string;
  nextRunAt: Date | null;
}

export async function findDueSources(
  db: Database,
  now = new Date(),
  limit = 100,
): Promise<DueSource[]> {
  return db
    .select({ id: sources.id, nextRunAt: sources.nextRunAt })
    .from(sources)
    .where(
      and(
        eq(sources.enabled, true),
        or(isNull(sources.nextRunAt), lte(sources.nextRunAt, now)),
      ),
    )
    .orderBy(asc(sources.nextRunAt))
    .limit(limit);
}
