import {sql,eq} from 'drizzle-orm';
import {sourceCatalogTypeSnapshots,type Database} from '@price-radar/database';
export const GOODS_TYPES=['card','article','resource','equity'] as const;
export const FULL_CATALOG_INTERVAL_MS=20*60*60_000;
export function selectCatalogTypes(lastFull:Date|null,states:readonly {goodsType:string;itemCount:number}[],now:Date): readonly string[] {
  if(!lastFull||now.getTime()-lastFull.getTime()>=FULL_CATALOG_INTERVAL_MS
    ||GOODS_TYPES.some(type=>!states.some(s=>s.goodsType===type)))return GOODS_TYPES;
  const active=GOODS_TYPES.filter(type=>states.some(s=>s.goodsType===type&&s.itemCount>0));
  return active.length?active:GOODS_TYPES;
}
export async function catalogTypesForSource(db:Database,sourceId:string,lastFull:Date|null,now:Date){
 const states=await db.select().from(sourceCatalogTypeSnapshots).where(eq(sourceCatalogTypeSnapshots.sourceId,sourceId));
 return selectCatalogTypes(lastFull,states,now);
}
/** Called in the same transaction as the validated run and source update. */
export async function promoteCatalogTypes(db:Pick<Database,'execute'>,sourceId:string,runId:string){
 await db.execute(sql`insert into source_catalog_type_snapshots(source_id,goods_type,run_id,checked_at,item_count)
   select r.source_id,t->>'type',r.id,r.finished_at,(t->>'count')::int
   from crawl_runs r cross join lateral jsonb_array_elements(coalesce(r.catalog_scope->'types','[]'::jsonb)) t
   where r.id=${runId}::uuid and r.source_id=${sourceId}::uuid and r.status='success' and r.finished_at is not null
   on conflict(source_id,goods_type) do update set run_id=excluded.run_id,checked_at=excluded.checked_at,item_count=excluded.item_count`);
}
/** Shared by publication and coverage tests. Partial updates only replace their own types. */
export const latestCatalogRowSql=sql`(
 (raw_offer_snapshots.goods_type is null and raw_offer_snapshots.crawl_run_id=sources.latest_complete_run_id)
 or (raw_offer_snapshots.goods_type is not null and exists(select 1 from source_catalog_type_snapshots ct
   where ct.source_id=raw_offer_snapshots.source_id and ct.goods_type=raw_offer_snapshots.goods_type
     and ct.run_id=raw_offer_snapshots.crawl_run_id)))`;
