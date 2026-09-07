import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@price-radar/database/schema";
import { refreshOfficialSubscriptionChannels, type SubscriptionRefreshOptions } from "@price-radar/price-channels/subscriptions";

const LOCK = 7410318;
const KIND = "official_subscription_refresh";
export function sweepIsDue(lastSuccess: Date | null, lastAttempt: Date | null, now: number, interval: number): boolean {
  if (lastSuccess && now - lastSuccess.getTime() < interval) return false;
  return !lastAttempt || now - lastAttempt.getTime() >= 60 * 60_000;
}

/** One connection holds the cross-process lock through the entire HTTP/browser sweep. */
export async function runSubscriptionSweep(databaseUrl: string, options: SubscriptionRefreshOptions & { force?: boolean; intervalMs?: number } = {}) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  let locked = false;
  let requestId: string | undefined;
  try {
    locked = (await client.query("select pg_try_advisory_lock($1) as acquired", [LOCK])).rows[0].acquired;
    if (!locked) return { status: "skipped", reason: "already_running" };
    const ready = (await client.query("select to_regclass('public.official_storefronts') is not null and exists(select 1 from information_schema.columns where table_name='official_subscription_checks' and column_name='evidence') as ready")).rows[0].ready;
    if (!ready) return {status: "skipped", reason: "migration_0017_pending"};
    // No live runner can hold this kind once we own its lock. Recover interrupted executions.
    await client.query("update operator_job_requests set status='failed',finished_at=now(),error_message='worker interrupted before completion' where kind=$1 and status='running'", [KIND]);
    const pending = (await client.query("select id from operator_job_requests where kind=$1 and status='pending' order by created_at limit 1", [KIND])).rows[0];
    const times = (await client.query("select max(finished_at) filter(where status='success' and result->>'scope'='full') as success, max(finished_at) filter(where result->>'scope'='full') as attempt from operator_job_requests where kind=$1", [KIND])).rows[0];
    if (!options.force && !pending && !sweepIsDue(times.success, times.attempt, Date.now(), options.intervalMs ?? 86_400_000)) return { status: "skipped", reason: "not_due" };
    requestId = pending?.id ?? (await client.query("insert into operator_job_requests(kind,status,requested_by,reason) values($1,'pending','dokploy-worker','daily full subscription sweep') returning id", [KIND])).rows[0].id;
    await client.query("update operator_job_requests set status='running',started_at=now(),finished_at=null where id=$1", [requestId]);
    const errors: string[] = [];
    const result = await refreshOfficialSubscriptionChannels(drizzle(client, { schema }), {
      ...options,
      onError: (source, error) => { errors.push(`${source}: ${error instanceof Error ? error.message : String(error)}`); options.onError?.(source, error); },
    });
    if (!result.exchangeRates) errors.push("exchange rates unavailable");
    if (!result.appStorePrices) errors.push("Apple sweep returned no prices");
    if (!result.googleWebPrices) errors.push("Google sweep returned no prices");
    if (!result.openAiWebPrices || result.openAiWebSkipped) errors.push("OpenAI browser sweep incomplete");
    const status = errors.length ? "failed" : "success";
    await client.query("update operator_job_requests set status=$2,result=$3,error_message=$4,finished_at=now() where id=$1", [requestId, status, JSON.stringify(result), errors.length ? errors.join("; ").slice(0, 2000) : null]);
    return { status, requestId, ...result, errors };
  } catch (error) {
    if (requestId) await client.query("update operator_job_requests set status='failed',result=$2,error_message=$3,finished_at=now() where id=$1", [requestId, JSON.stringify({scope: options.scope ?? "full"}), error instanceof Error ? error.message.slice(0,2000) : "sweep_failed"]).catch(() => undefined);
    throw error;
  } finally {
    if (locked) await client.query("select pg_advisory_unlock($1)", [LOCK]).catch(() => undefined);
    await client.end();
  }
}
