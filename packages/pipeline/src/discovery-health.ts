import { sql } from "drizzle-orm";
import type { Database } from "@price-radar/database";
import { boundedDiscoveryRead } from "./discovery-schedule.js";
import { discoveryDecision, type DiscoveryAttempt } from "./discovery-policy.js";

export interface DiscoveryProviderSchedule { provider: string; kind: string; enabled: boolean; intervalMs: number }
export interface DiscoveryHealthSample {
  attempts: DiscoveryAttempt[]; lastSuccessAt: Date | null; attemptsHour: number; attemptsDay: number;
}

export function evaluateDiscoveryHealth(schedule: DiscoveryProviderSchedule, sample: DiscoveryHealthSample, now: Date, startedAt: Date) {
  const { provider, enabled, intervalMs } = schedule;
  const last = sample.attempts[0];
  const decision = discoveryDecision(sample.attempts, intervalMs, now);
  const issues: string[] = [], warnings: string[] = [];
  const grace = now.getTime() - startedAt.getTime() < 35 * 60_000;
  if (enabled) {
    if (sample.attemptsHour > Math.max(4, Math.ceil(3_600_000 / intervalMs) * 4)) issues.push("attempt_rate_excessive");
    if (sample.attemptsDay > Math.max(12, Math.ceil(86_400_000 / intervalMs) * 4)) warnings.push("attempts_24h_excessive");
    if (!grace && !last) issues.push("never_run");
    const recentFailures = sample.attempts.slice(0, 3).filter(row => row.status === "failed").length;
    if (recentFailures === 3 && (!sample.lastSuccessAt || now.getTime() - sample.lastSuccessAt.getTime() > intervalMs * 2)) issues.push("persistent_failure");
    if (!grace && last) {
      if (last.status === "running") {
        if (now.getTime() - last.startedAt.getTime() > 35 * 60_000) issues.push("running_overdue_inspect_owner");
      } else {
        const scheduled = discoveryDecision(sample.attempts, intervalMs, new Date(0));
        const dueAt = scheduled ? Date.parse(scheduled.retryAt) : last.status === "success"
          ? (last.finishedAt ?? last.startedAt).getTime() + intervalMs
          : (last.finishedAt ?? last.startedAt).getTime();
        if (now.getTime() - dueAt > 35 * 60_000) issues.push("scheduler_overdue");
      }
    }
  }
  return { provider, enabled, state: !enabled ? "paused" : last?.status === "running" ? "running" : decision?.status ?? "due",
    lastStartedAt: last?.startedAt.toISOString() ?? null, lastSuccessAt: sample.lastSuccessAt?.toISOString() ?? null,
    lastError: last?.errorMessage ?? null, retryAt: decision?.retryAt ?? null,
    attemptsHour: sample.attemptsHour, attemptsDay: sample.attemptsDay, issues, warnings };
}

/** Only small discovery metadata is queried, under a five-second read-only timeout. */
export async function readDiscoveryHealth(db: Database, schedules: DiscoveryProviderSchedule[], startedAt: Date) {
  const now = new Date();
  const providers = [];
  for (const schedule of schedules) {
    const sample = await boundedDiscoveryRead(db, async readDb => {
      const { rows } = await readDb.execute<{
        status:string; started_at:Date|string; finished_at:Date|string|null; error_message:string|null; evidence:Record<string,unknown>
      }>(sql`select status, started_at, finished_at, error_message, evidence from discovery_runs
        where kind=${schedule.kind} and provider=${schedule.provider} order by started_at desc limit 16`);
      const stats = await readDb.execute<{last_success_at:Date|string|null; attempts_hour:number; attempts_day:number}>(sql`
        select max(finished_at) filter(where status='success') last_success_at,
          count(*) filter(where started_at > now()-interval '1 hour')::int attempts_hour,
          count(*) filter(where started_at > now()-interval '24 hours')::int attempts_day
        from discovery_runs where kind=${schedule.kind} and provider=${schedule.provider}`);
      const row=stats.rows[0]!;
      return { attempts: rows.map(row=>({status:row.status,startedAt:new Date(row.started_at),finishedAt:row.finished_at?new Date(row.finished_at):null,errorMessage:row.error_message,evidence:row.evidence})),
        lastSuccessAt:row.last_success_at?new Date(row.last_success_at):null, attemptsHour:row.attempts_hour, attemptsDay:row.attempts_day };
    });
    providers.push(evaluateDiscoveryHealth(schedule,sample,now,startedAt));
  }
  return { checkedAt: now.toISOString(), healthy: providers.every(provider=>provider.issues.length===0), providers };
}
