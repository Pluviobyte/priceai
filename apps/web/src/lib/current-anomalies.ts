/** Same per-type/current-full selection used by publication; fixed SQL aliases only. */
export const currentAnomalyJoins = `from offer_anomalies oa
  join raw_offer_snapshots ros on ros.id=oa.raw_offer_snapshot_id
  join sources s on s.id=ros.source_id and s.enabled and (
    (ros.goods_type is null and ros.crawl_run_id=s.latest_complete_run_id)
    or (ros.goods_type is not null and exists(select 1 from source_catalog_type_snapshots ct
      where ct.source_id=ros.source_id and ct.goods_type=ros.goods_type and ct.run_id=ros.crawl_run_id)))`;
export const currentAnomalyCount = `select count(*) ${currentAnomalyJoins} where oa.status='open'`;
