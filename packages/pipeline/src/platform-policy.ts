import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { sql, type SQL } from 'drizzle-orm';
import { type Database } from '@price-radar/database';
import { PlatformDeferredError, platformRetryAt, mentionsWafChallenge, type RequestPolicy } from '@price-radar/collector-sdk';
import { familyForHost, LDXP_FAMILY, SIXTEEN688_FAMILY } from '@price-radar/source-signatures';

export function platformKey(hostname: string): string {
  return familyForHost(hostname)?.platformKind ?? `host:${hostname.toLowerCase()}`;
}
/** Invalid candidate URLs still go through normal vetting rejection. */
export function platformKeyForUrl(url: string): string {
  try { return platformKey(new URL(url).hostname); }
  catch { return 'invalid-url'; }
}
/** Match the request gate by actual host, never by generic collector kind. */
export function platformKeySql(url: SQL): SQL {
  const host = sql`lower(split_part(split_part(split_part(${url}, '://', 2), '/', 1), ':', 1))`;
  return sql`case when ${host} in (${sql.join(LDXP_FAMILY.hosts.map(h => sql`${h}`), sql`,`)}) then 'ldxp_shop_api'
    when ${host} in (${sql.join(SIXTEEN688_FAMILY.hosts.map(h => sql`${h}`), sql`,`)}) then 'shop_api_16688'
    else 'host:' || ${host} end`;
}
function integerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
export function platformPolicyConfig() {
  return {
    intervalMs: integerEnv('SHOP_API_PLATFORM_INTERVAL_MS', 5000),
    dailyLimit: Math.max(0, Number.isSafeInteger(Number(process.env.SHOP_API_PLATFORM_DAILY_REQUESTS)) ? Number(process.env.SHOP_API_PLATFORM_DAILY_REQUESTS) : 0),
    wafThreshold: integerEnv('SHOP_API_PLATFORM_WAF_THRESHOLD', 3),
    cooldownMs: integerEnv('SHOP_API_PLATFORM_COOLDOWN_MS', 24 * 60 * 60_000),
  };
}
/** Used before scheduling, so sleeping/budget-limited platforms consume no batch slots. */
export function platformAvailableSql(key: SQL): SQL {
  const { dailyLimit } = platformPolicyConfig();
  return sql`not exists (select 1 from collector_platform_state ps where ps.key=${key} and
    (ps.blocked_until > now() or ps.lease_until > now() or ps.next_request_at > now() or
      (${dailyLimit} > 0 and ps.budget_day=(now() at time zone 'UTC')::date and ps.request_count >= ${dailyLimit})))`;
}

/** Each HTTP attempt reserves one slot. A token fences completion after lease expiry.
 * The worker's HTTP timeout is 15s; the lease lasts 60s. A cooldown's first request
 * is single-flight too. Transport failures during recovery reopen the cooldown.
 */
export class PostgresRequestPolicy implements RequestPolicy {
  constructor(private readonly db: Database, private readonly config = platformPolicyConfig()) {}
  async run<T>(hostname: string, work: () => Promise<T>, signal: AbortSignal): Promise<T> {
    const key = platformKey(hostname);
    const token = randomUUID();
    while (true) {
      signal.throwIfAborted();
      const slot = await this.db.transaction(async tx => {
        await tx.execute(sql`insert into collector_platform_state(key) values(${key}) on conflict do nothing`);
        const { rows } = await tx.execute<{
          blocked_until: Date | null; lease_until: Date | null; next_request_at: Date | null;
          request_count: number; today: boolean; now: Date; next_day: Date;
        }>(sql`select *, budget_day=(now() at time zone 'UTC')::date as today, now() as now,
          ((date_trunc('day', now() at time zone 'UTC') + interval '1 day') at time zone 'UTC') as next_day
          from collector_platform_state where key=${key} for update`);
        const row = rows[0]!;
        const now = new Date(row.now).getTime();
        if (row.blocked_until && +new Date(row.blocked_until) > now)
          throw new PlatformDeferredError(new Date(row.blocked_until), 'circuit_open');
        if (this.config.dailyLimit > 0 && row.today && row.request_count >= this.config.dailyLimit)
          throw new PlatformDeferredError(new Date(row.next_day), 'daily_budget');
        const wait = Math.max(0, +(row.lease_until ? new Date(row.lease_until) : 0) - now,
          +(row.next_request_at ? new Date(row.next_request_at) : 0) - now);
        if (wait > 0) return { wait, recovery: false };
        await tx.execute(sql`update collector_platform_state set lease_token=${token}::uuid,
          lease_until=now()+interval '60 seconds', next_request_at=now()+${this.config.intervalMs}*interval '1 millisecond',
          request_count=case when budget_day=(now() at time zone 'UTC')::date then request_count+1 else 1 end,
          budget_day=(now() at time zone 'UTC')::date, updated_at=now() where key=${key}`);
        return { wait: 0, recovery: row.blocked_until !== null };
      });
      if (slot.wait > 0) { await setTimeout(Math.min(slot.wait, 1000), undefined, { signal }); continue; }
      let retryAt: Date | undefined;
      let outcome: 'success' | 'waf' | 'error' = 'error';
      try {
        signal.throwIfAborted();
        const value = await work();
        outcome = 'success';
        return value;
      } catch (error) {
        retryAt = platformRetryAt(String(error));
        if (mentionsWafChallenge(String(error)) || /shop_api_access_challenge/.test(String(error))) outcome = 'waf';
        throw error;
      } finally {
        await this.db.execute(sql`update collector_platform_state set lease_token=null, lease_until=null,
          waf_streak=case when ${outcome}='success' then 0 when ${outcome}='waf' then waf_streak+1 else waf_streak end,
          blocked_until=case when ${outcome}='success' then null
            when (${outcome}='waf' and waf_streak+1 >= ${this.config.wafThreshold}) or ${slot.recovery}
              then now()+${this.config.cooldownMs}*interval '1 millisecond' else blocked_until end,
          next_request_at=greatest(next_request_at, ${retryAt ?? null}::timestamptz),
          updated_at=now() where key=${key} and lease_token=${token}::uuid`);
      }
    }
  }
}
