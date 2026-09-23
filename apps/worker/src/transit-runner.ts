import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@price-radar/database/schema";
import { refreshAllTransitProviders } from "@price-radar/price-channels";
import { sweepIsDue } from "./subscription-runner.js";

// Dedicated key: 7410318 is subscriptions, 7410319 channel cycle, 7410320 vetting.
export const TRANSIT_CATALOG_LOCK = 7410321;
const KIND = "transit_catalog_refresh";

/** Separate schedule and cross-process lock; never waits for the subscription sweep. */
export async function runTransitSweep(databaseUrl: string) {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  await client.connect();
  let locked = false;
  let requestId: string | undefined;
  try {
    locked = (await client.query("select pg_try_advisory_lock($1) as acquired", [TRANSIT_CATALOG_LOCK])).rows[0].acquired;
    if (!locked) return { status: "skipped", reason: "already_running" };
    await client.query("update operator_job_requests set status='failed',finished_at=now(),error_message='worker interrupted' where kind=$1 and status='running'", [KIND]);
    const times = (await client.query("select max(finished_at) filter(where status='success') as success,max(finished_at) as attempt from operator_job_requests where kind=$1", [KIND])).rows[0];
    const last = (await client.query("select result from operator_job_requests where kind=$1 order by created_at desc limit 1", [KIND])).rows[0]?.result;
    const retryDates = Object.values(last ?? {}).map(value => value && typeof value === "object" && "retryAt" in value ? Date.parse(String(value.retryAt)) : 0);
    if (retryDates.some(at => at > Date.now())) return { status: "skipped", reason: "retry_after" };
    if (!sweepIsDue(times.success, times.attempt, Date.now(), 86_400_000)) return { status: "skipped", reason: "not_due" };
    requestId = (await client.query("insert into operator_job_requests(kind,status,requested_by,reason,started_at) values($1,'running','official-worker','daily public transit catalog',now()) returning id", [KIND])).rows[0].id;
    const providers = await refreshAllTransitProviders(drizzle(client, { schema }));
    const status = Object.values(providers).every(provider => provider.success) ? "success" : "partial";
    await client.query("update operator_job_requests set status=$2,result=$3,finished_at=now() where id=$1", [requestId, status, JSON.stringify(providers)]);
    return { status, providers };
  } catch (error) {
    if (requestId) await client.query("update operator_job_requests set status='failed',error_message=$2,finished_at=now() where id=$1", [requestId, error instanceof Error ? error.message.slice(0, 300) : "transit_failed"]).catch(() => undefined);
    throw error;
  } finally {
    if (locked) await client.query("select pg_advisory_unlock($1)", [TRANSIT_CATALOG_LOCK]).catch(() => undefined);
    await client.end();
  }
}
