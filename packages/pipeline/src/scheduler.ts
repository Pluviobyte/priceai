import { and, asc, desc, eq, isNull, lte, or } from "drizzle-orm";
import { sourceCandidates, sources, sourceSubmissions, type Database } from "@price-radar/database";

export interface DueSource {
  id: string;
  nextRunAt: Date | null;
  collectorKind: string;
}

export async function findDueSources(
  db: Database,
  now = new Date(),
  limit = 100,
): Promise<DueSource[]> {
  return db
    .select({ id: sources.id, nextRunAt: sources.nextRunAt, collectorKind: sources.collectorKind })
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

/** Candidates waiting for automatic vetting, most widely listed first. */
export async function findVettableCandidates(
  db: Database,
  limit = 5,
  now = new Date(),
): Promise<Array<{ id: string; candidateUrl: string; priority: number }>> {
  return db
    .select({ id: sourceCandidates.id, candidateUrl: sourceCandidates.candidateUrl, priority: sourceCandidates.priority })
    .from(sourceCandidates)
    .where(
      and(
        eq(sourceCandidates.status, "pending"),
        or(isNull(sourceCandidates.nextVetAt), lte(sourceCandidates.nextVetAt, now)),
      ),
    )
    .orderBy(desc(sourceCandidates.priority), asc(sourceCandidates.discoveredAt))
    .limit(limit);
}
