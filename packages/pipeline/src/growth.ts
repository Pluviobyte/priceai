import { platformKeySql } from './platform-policy.js';
import { isUtilityHost } from './discovery-links.js';
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
  const coverage = await db.execute(sql`select
    count(*)::int as enabled_sources,
    count(*) filter(where last_success_at > now()-interval '24 hours')::int as sources_success_24h,
    count(*) filter(where last_success_at is null or last_success_at <= now()-interval '24 hours')::int as sources_missing_24h,
    count(*) filter(where health_status='blocked_egress')::int as sources_blocked_egress,
    count(*) filter(where health_status in ('failing','retrying'))::int as sources_retrying
    from sources where enabled`);
  return {...rows[0], ...coverage.rows[0]};
}

/** Re-evaluate only automatic decisions explained by the repaired classifier or
 * old WAF handling. Existing manual reviews and new-version decisions stay put. */
export async function recoverGrowthCandidates(db: Database, limit = 30) {
  const {rows} = await db.execute<{id:string}>(sql`with selected as (
    select id from source_candidates
    where status in ('review','rejected','blocked_egress')
      and vetting_result->>'version' like 'vetting-%'
      and vetting_result->>'version' not in ('vetting-2026-09-09.1','vetting-2026-09-10.1')
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

/** Resume only automatically parked siblings after their platform has recovered.
 * Null/old vetting evidence is expected: these shops were never individually probed.
 */
export async function recoverClearedPlatformCandidates(db: Database, limit = 100) {
  const {rows}=await db.execute<{id:string}>(sql`with selected as (
    select c.id from source_candidates c join collector_platform_state ps on ps.key=${platformKeySql(sql`c.candidate_url`)}
    where c.status='blocked_egress' and ps.waf_streak=0 and (ps.blocked_until is null or ps.blocked_until<=now())
      and exists(select 1 from audit_logs a where a.target_id=c.id::text and a.actor_id='automatic_vetting'
        and a.action='source_candidate.blocked_egress' and a.reason='platform circuit open; no probe issued'
        and ps.updated_at>a.created_at
        and not exists(select 1 from audit_logs newer where newer.target_id=c.id::text
          and newer.action like 'source_candidate.%' and newer.created_at>a.created_at))
      and not exists(select 1 from audit_logs a where a.target_id=c.id::text and a.actor_id<>'automatic_vetting' and a.action like 'source_candidate.%')
    order by c.priority desc,c.discovered_at limit ${Math.max(1,Math.min(limit,1000))} for update of c skip locked
  ), changed as (
    update source_candidates c set status='pending',next_vet_at=now(),
      vetting_result=coalesce(c.vetting_result,'{}'::jsonb)||jsonb_build_object('platformRecoveryVersion','2026-09-09.2')
    from selected where c.id=selected.id returning c.id
  ), audited as (
    insert into audit_logs(actor_id,action,target_type,target_id,reason,after_value)
    select 'automatic_vetting','source_candidate.platform_recovered','source_candidate',id::text,
      'platform recovered; resume siblings previously parked without a probe','{"status":"pending"}'::jsonb from changed
  ) select id from changed`);
  return {requeued:rows.length};
}

/** One-time rechecks for corrected admission rules; never bypass a human decision. */
export async function recoverAdmissionCandidates(db: Database, limit = 100) {
  const {rows}=await db.execute<{id:string}>(sql`with selected as (
    select c.id from source_candidates c
    where c.status in ('review','adapter_needed')
      and coalesce(c.vetting_result->>'version','')<>'vetting-2026-09-10.1'
      and coalesce(c.vetting_result->>'admissionRecoveryVersion','')<>'2026-09-10.1'
      and (c.status='adapter_needed' or exists (
        select 1 from jsonb_array_elements_text(case when jsonb_typeof(c.vetting_result->'reasons')='array'
          then c.vetting_result->'reasons' else '[]'::jsonb end) reason
        where reason like 'low_ai_relevance:%' or reason like 'trial_incomplete:%' or reason='probe_transient_failure'))
      and not exists(select 1 from audit_logs a where a.target_id=c.id::text
        and a.actor_id<>'automatic_vetting' and a.action like 'source_candidate.%')
    order by c.priority desc,c.discovered_at limit ${Math.max(1,Math.min(limit,1000))} for update of c skip locked
  ), changed as (
    update source_candidates c set status='pending',next_vet_at=now(),
      vetting_result=coalesce(c.vetting_result,'{}'::jsonb)||jsonb_build_object(
        'previousAdmissionDecision',c.vetting_result,'attempts',0,'admissionRecoveryVersion','2026-09-10.1')
    from selected where c.id=selected.id returning c.id
  ), audited as (
    insert into audit_logs(actor_id,action,target_type,target_id,reason,after_value)
    select 'automatic_vetting','source_candidate.admission_recheck','source_candidate',id::text,
      'product-level admission and corrected probe classification; full checks required',
      '{"status":"pending","version":"2026-09-10.1"}'::jsonb from changed
  ) select id from changed`);
  return {requeued:rows.length};
}

/** One-time recheck for the loosened classifier. Shops rejected only because nothing in
 * their catalogue looked AI-related may match now that brand-obfuscated and brandless
 * plan wording resolves. Manual decisions are never touched. */
export async function recoverClassifierCandidates(db: Database, limit = 100) {
  const {rows}=await db.execute<{id:string}>(sql`with selected as (
    select c.id from source_candidates c
    where c.status in ('review','rejected','blocked_egress')
      and coalesce(c.vetting_result->>'classifierRecoveryVersion','')<>'2026-09-11.1'
      and c.vetting_result->'reasons' @> '["no_ai_relevant_items"]'::jsonb
      and not exists(select 1 from audit_logs a where a.target_id=c.id::text
        and a.actor_id<>'automatic_vetting' and a.action like 'source_candidate.%')
    order by c.priority desc,c.discovered_at limit ${Math.max(1,Math.min(limit,1000))} for update of c skip locked
  ), changed as (
    update source_candidates c set status='pending',next_vet_at=now(),
      vetting_result=coalesce(c.vetting_result,'{}'::jsonb)||jsonb_build_object(
        'previousClassifierDecision',c.vetting_result,'attempts',0,'classifierRecoveryVersion','2026-09-11.1')
    from selected where c.id=selected.id returning c.id
  ), audited as (
    insert into audit_logs(actor_id,action,target_type,target_id,reason,after_value)
    select 'automatic_vetting','source_candidate.classifier_recheck','source_candidate',id::text,
      'loosened classifier now resolves obfuscated and brandless plan wording; full admission checks still required',
      '{"status":"pending","version":"2026-09-11.1"}'::jsonb from changed
  ) select id from changed`);
  return {requeued:rows.length};
}

/** A file-sharing or cloud-phone link can never be a shop, yet a rejected candidate
 * returns to the queue once next_vet_at passes. Clearing next_vet_at is what actually
 * stops the probing; discovery already refuses to add new ones. */
export async function retireUtilityHostCandidates(db: Database, limit = 2000) {
  const {rows}=await db.execute<{id:string;candidate_url:string}>(sql`
    select c.id, c.candidate_url from source_candidates c
    where c.status in ('pending','review','rejected','adapter_needed','blocked_egress')
      and coalesce(c.vetting_result->>'retiredReason','')<>'utility_host'
      and not exists(select 1 from audit_logs a where a.target_id=c.id::text
        and a.actor_id<>'automatic_vetting' and a.action like 'source_candidate.%')
    limit ${Math.max(1,Math.min(limit,5000))}`);
  const retire=rows.filter(row=>{
    try { return isUtilityHost(new URL(row.candidate_url).hostname); } catch { return false; }
  });
  if (!retire.length) return {retired:0};
  const ids=sql.join(retire.map(row=>sql`${row.id}::uuid`),sql`,`);
  await db.execute(sql`with changed as (
    update source_candidates set status='rejected', next_vet_at=null,
      vetting_result=coalesce(vetting_result,'{}'::jsonb)||jsonb_build_object('retiredReason','utility_host','retiredVersion','2026-09-11.1')
    where id in (${ids}) returning id
  ) insert into audit_logs(actor_id,action,target_type,target_id,reason,after_value)
    select 'automatic_vetting','source_candidate.retired','source_candidate',id::text,
      'file-sharing or cloud-phone host cannot be a shop; cleared next_vet_at so the queue stops probing it',
      '{"status":"rejected","nextVetAt":null}'::jsonb from changed`);
  return {retired:retire.length};
}
