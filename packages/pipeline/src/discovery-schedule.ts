import { and, desc, eq, sql } from "drizzle-orm";
import { discoveryRuns, type Database } from "@price-radar/database";
import { recordDiscoveryRun, type CandidateLead, type DiscoveryRunInput } from "./candidates.js";
import { DISCOVERY_OWNERSHIP, discoveryDecision, discoveryFailureCount, type DiscoveryAttempt } from "./discovery-policy.js";

export interface DiscoveryScheduleOptions { signal?: AbortSignal; minIntervalMs?: number; now?: Date }

/** One provider at a time across automatic and CLI callers, without a long DB transaction. */
export async function runScheduledDiscovery(db: Database, input: DiscoveryRunInput, options: DiscoveryScheduleOptions, work: (signal: AbortSignal) => Promise<CandidateLead[]>) {
  options.signal?.throwIfAborted();
  if (!db.$client) throw new Error("discovery_requires_pool_not_transaction");
  const connection = await db.$client.connect();
  const lost = new AbortController();
  const onError = (error: Error) => lost.abort(error);
  connection.on("error", onError);
  let locked = false;
  try {
    locked = (await connection.query("select pg_try_advisory_lock(7410320, hashtext($1)) as acquired", [input.provider])).rows[0].acquired === true;
    if (!locked) return { status: "deferred" as const, reason: "provider_running" };
    // Only the new protocol owns these rows. Holding its lock proves no owner
    // still has the session; legacy untagged rows are deliberately left alone.
    await db.update(discoveryRuns).set({ status: "failed", errorMessage: "discovery_owner_disconnected", finishedAt: new Date(),
      evidence: { ownership: DISCOVERY_OWNERSHIP, interrupted: true } })
      .where(and(eq(discoveryRuns.kind, input.kind), eq(discoveryRuns.provider, input.provider), eq(discoveryRuns.status, "running"),
        sql`${discoveryRuns.evidence}->>'ownership' = ${DISCOVERY_OWNERSHIP}`));
    const attempts = await db.select().from(discoveryRuns)
      .where(and(eq(discoveryRuns.kind, input.kind), eq(discoveryRuns.provider, input.provider)))
      .orderBy(desc(discoveryRuns.startedAt)).limit(16);
    const decision = discoveryDecision(attempts as DiscoveryAttempt[], options.minIntervalMs, options.now ?? new Date());
    if (decision) return decision;
    const failures = discoveryFailureCount(attempts as DiscoveryAttempt[]) + 1;
    const signal = AbortSignal.any([options.signal ?? new AbortController().signal, lost.signal, AbortSignal.timeout(30 * 60_000)]);
    signal.throwIfAborted();
    const run = await recordDiscoveryRun(db, { ...input, ownership: DISCOVERY_OWNERSHIP, consecutiveFailures: failures }, async () => {
      const leads = await work(signal);
      signal.throwIfAborted();
      return leads;
    }, signal);
    return { status: "success" as const, ...run };
  } finally {
    // A broken session must never be put back in the pool with a retained lock.
    let broken = lost.signal.aborted;
    if (locked && !broken) {
      try { await connection.query("select pg_advisory_unlock(7410320, hashtext($1))", [input.provider]); }
      catch { broken = true; }
    }
    connection.removeListener("error", onError);
    connection.release(broken);
  }
}

/** Catalog discovery reads get their own short, read-only transaction. */
export async function boundedDiscoveryRead<T>(db: Database, read: (db: Database) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.execute(sql`set local statement_timeout = '5s'`);
    await tx.execute(sql`set local lock_timeout = '500ms'`);
    return read(tx);
  }, { accessMode: "read only" });
}
