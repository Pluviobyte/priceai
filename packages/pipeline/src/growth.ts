import { sql } from 'drizzle-orm';
import type { Database } from '@price-radar/database';

/** Operational counts use the current generation, never historical snapshots. */
export async function measureCatalogGrowth(db: Database) {
  const {rows} = await db.execute(sql`select now() as checked_at,
    count(*)::int as recorded_offers,
    count(*) filter(where o.availability_state<>'quarantined')::int as valid_offers,
    count(distinct s.merchant_id) filter(where o.availability_state<>'quarantined')::int as merchants,
    count(*) filter(where o.availability_state='purchasable' and o.stock_state in ('in_stock','low_stock')
      and (o.stock_count is null or o.stock_count>0) and o.offer_verified_at>now()-interval '24 hours')::int as fresh_in_stock,
    count(*) filter(where (cp.slug like 'resource-%' or o.offer_mode='api_credit') and o.availability_state<>'quarantined')::int as resource_offers,
    count(*) filter(where o.availability_state='quarantined')::int as quarantined,
    600 as merchant_target,8000 as offer_target,5000 as fresh_stock_target
    from offers o join publication_channels p on p.current_generation_id=o.publish_generation_id and p.channel='card_prices'
    join sources s on s.id=o.source_id join merchants m on m.id=s.merchant_id
    join canonical_products cp on cp.id=o.canonical_product_id
    where s.enabled and m.status='active' and cp.status='active'`);
  return rows[0];
}

/** Re-evaluate only automatic decisions explained by the repaired classifier or
 * old WAF handling. Existing manual reviews and new-version decisions stay put. */
export async function recoverGrowthCandidates(db: Database, limit = 30) {
  const {rows} = await db.execute<{id:string}>(sql`with selected as (
    select id from source_candidates
    where status in ('review','rejected','blocked_egress')
      and vetting_result->>'version' like 'vetting-%'
      and vetting_result->>'version'<>'vetting-2026-09-09.1'
      and coalesce(vetting_result->>'growthRecoveryVersion','')<>'2026-09-09.1'
      and (vetting_result->'reasons' @> '["no_ai_relevant_items"]'::jsonb
        or (platform_kind='ldxp_shop_api' and exists (
          select 1 from jsonb_array_elements_text(case when jsonb_typeof(vetting_result->'reasons')='array'
            then vetting_result->'reasons' else '[]'::jsonb end) reason
          where reason like 'source_access_challenge:%' or reason like 'waf_challenge:%')))
      and not exists (select 1 from audit_logs a where a.target_id=source_candidates.id::text
        and a.actor_id<>'automatic_vetting' and a.action like 'source_candidate.%')
    order by priority desc,discovered_at limit ${Math.max(1,Math.min(limit,100))} for update skip locked
  ), changed as (
    update source_candidates c set status='pending', next_vet_at=now(),
      vetting_result=c.vetting_result || jsonb_build_object('previousVetting',c.vetting_result,'attempts',0,'growthRecoveryVersion','2026-09-09.1')
    from selected where c.id=selected.id returning c.id
  ), audited as (
    insert into audit_logs(actor_id,action,target_type,target_id,reason,after_value)
    select 'automatic_vetting','source_candidate.growth_recheck','source_candidate',id::text,
      'new classifier and Hangzhou egress; normal admission checks still required',
      '{"status":"pending","version":"2026-09-09.1"}'::jsonb from changed
  ) select id from changed`);
  return {requeued:rows.length};
}
