import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { sources, sourceSubmissions, type Database } from "@price-radar/database";

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

export async function findPendingSourceSubmissions(
  db: Database,
  limit = 25,
  now = new Date(),
): Promise<Array<{ id: string; updatedAt: Date }>> {
  return db
    .select({ id: sourceSubmissions.id, updatedAt: sourceSubmissions.updatedAt })
    .from(sourceSubmissions)
    .where(
      or(
        eq(sourceSubmissions.status, "submitted"),
        and(
          eq(sourceSubmissions.status, "prechecked"),
          lte(sourceSubmissions.updatedAt, new Date(now.getTime() - 60 * 60_000)),
        ),
      ),
    )
    .orderBy(asc(sourceSubmissions.updatedAt))
    .limit(limit);
}
