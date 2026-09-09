import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { sources, sourceSubmissions, type Database } from "@price-radar/database";

import { platformAvailableSql, platformKeySql } from "./platform-policy.js";

export interface DueSource {
  id: string;
  nextRunAt: Date | null;
  collectorKind: string;
  canonicalEntryUrl: string;
}

export async function findDueSources(
  db: Database,
  now = new Date(),
  limit = 100,
): Promise<DueSource[]> {
  return db
    .select({ id: sources.id, nextRunAt: sources.nextRunAt, collectorKind: sources.collectorKind, canonicalEntryUrl: sources.canonicalEntryUrl })
    .from(sources)
    .where(
      and(
        eq(sources.enabled, true),
        platformAvailableSql(platformKeySql(sql`${sources.canonicalEntryUrl}`)),
        or(isNull(sources.nextRunAt), lte(sources.nextRunAt, now)),
      ),
    )
    .orderBy(sql`${sources.lastSuccessAt} asc nulls first`, sql`${sources.nextRunAt} asc nulls first`, asc(sources.id))
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

/** Platform-fair queue; priority orders candidates within each platform. */
export async function findVettableCandidates(
  db: Database,
  limit = 5,
  now = new Date(),
): Promise<Array<{ id: string; candidateUrl: string; priority: number }>> {
  const key = platformKeySql(sql`c.candidate_url`);
  const { rows } = await db.execute<{ id: string; candidateUrl: string; priority: number }>(sql`
    with ranked as (
      select c.id, c.candidate_url as "candidateUrl", c.priority, c.discovered_at,
        ps.last_served_at,
        row_number() over (partition by ${key} order by c.priority desc, c.discovered_at, c.id) as platform_rank
      from source_candidates c left join collector_platform_state ps on ps.key=${key}
      where c.status='pending' and (c.next_vet_at is null or c.next_vet_at <= ${now})
        and ${platformAvailableSql(key)}
    ) select id, "candidateUrl", priority from ranked
      order by platform_rank, last_served_at asc nulls first, priority desc, discovered_at, id
      limit ${Math.max(1, limit)}
  `);
  return rows;
}
