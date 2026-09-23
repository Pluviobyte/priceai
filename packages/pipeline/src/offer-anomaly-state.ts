import { isDeepStrictEqual } from 'node:util';
import { and, eq, sql } from 'drizzle-orm';
import { offerAnomalies, type Database } from '@price-radar/database';
import type { OfferAnomaly } from '@price-radar/anomaly-detector';

type AnomalyRow = typeof offerAnomalies.$inferSelect;
type Stored = { anomaly: AnomalyRow; ignored: boolean };
export type AnomalyState = Map<string, Map<string, Stored>>;
const itemKey = (sourceId: string, itemId: string) => JSON.stringify([sourceId, itemId]);

/** One representative per stable item/kind. Legacy duplicate cleanup is a separate job.
 * Prefer the current raw row to avoid the existing snapshot/kind unique constraint.
 * The publisher's advisory lock serializes this with other publishers. */
export async function loadAnomalyState(db: Pick<Database, 'execute'>): Promise<AnomalyState> {
  const result = await db.execute(sql`
    select distinct on (a.source_id,r.source_item_id,a.kind) a.*,r.source_item_id,
      bool_or(a.status='ignored') over(partition by a.source_id,r.source_item_id,a.kind) as ignored
    from offer_anomalies a join raw_offer_snapshots r on r.id=a.raw_offer_snapshot_id
    join sources s on s.id=r.source_id and s.enabled
    order by a.source_id,r.source_item_id,a.kind,
      ((r.goods_type is null and r.crawl_run_id=s.latest_complete_run_id) or
       (r.goods_type is not null and exists(select 1 from source_catalog_type_snapshots ct
        where ct.source_id=r.source_id and ct.goods_type=r.goods_type and ct.run_id=r.crawl_run_id))) desc,
      a.detected_at desc,a.id desc
  `);
  const state: AnomalyState = new Map();
  for (const row of result.rows) {
    const key = itemKey(String(row.source_id), String(row.source_item_id));
    const group = state.get(key) ?? new Map<string, Stored>();
    group.set(String(row.kind), { ignored: row.ignored === true, anomaly: {
      id: String(row.id), sourceId: String(row.source_id), rawOfferSnapshotId: String(row.raw_offer_snapshot_id),
      offerId: row.offer_id ? String(row.offer_id) : null, kind: String(row.kind), severity: String(row.severity),
      observedValue: row.observed_value, baselineValue: row.baseline_value, details: row.details as Record<string, unknown>,
      status: String(row.status), detectedAt: new Date(String(row.detected_at)),
      resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)) : null,
    }});
    state.set(key, group);
  }
  return state;
}

export async function reconcileOfferAnomalies(db: Pick<Database, 'insert' | 'update'>, state: AnomalyState,
  item: { sourceId: string; sourceItemId: string; rawId: string; offerId?: string }, detected: OfferAnomaly[], now: Date) {
  const group = state.get(itemKey(item.sourceId, item.sourceItemId)) ?? new Map<string, Stored>();
  const kinds = new Set(detected.map(anomaly => anomaly.kind));
  for (const [kind, previous] of group) {
    if (!kinds.has(kind) && previous.anomaly.status === 'open') {
      // Never overwrite an administrator's concurrent ignore decision.
      await db.update(offerAnomalies).set({ status: 'resolved', resolvedAt: now,
        details: { ...previous.anomaly.details, resolutionReason: 'condition_cleared' } })
        .where(and(eq(offerAnomalies.id, previous.anomaly.id), eq(offerAnomalies.status, 'open')));
    }
  }
  for (const anomaly of detected) {
    const previous = group.get(anomaly.kind);
    const values = { rawOfferSnapshotId: item.rawId, sourceId: item.sourceId,
      offerId: item.offerId ?? previous?.anomaly.offerId ?? null,
      kind: anomaly.kind, severity: anomaly.severity, observedValue: anomaly.observedValue ?? null,
      baselineValue: anomaly.baselineValue ?? null, details: anomaly.details };
    if (!previous) {
      await db.insert(offerAnomalies).values({ ...values, status: 'open', detectedAt: now });
      continue;
    }
    const stored = previous.anomaly;
    if (stored.status !== 'resolved' && Object.entries(values).every(([key, value]) =>
      isDeepStrictEqual(stored[key as keyof AnomalyRow], value)) && (!previous.ignored || stored.status === 'ignored')) continue;
    await db.update(offerAnomalies).set({ ...values,
      status: sql`case when ${offerAnomalies.status}='ignored' or ${previous.ignored} then 'ignored' else 'open' end`,
      detectedAt: sql`case when ${offerAnomalies.status}='resolved' then ${now} else ${offerAnomalies.detectedAt} end`,
      resolvedAt: sql`case when ${offerAnomalies.status}='ignored' then ${offerAnomalies.resolvedAt} when ${previous.ignored} then ${now} else null end`,
    }).where(eq(offerAnomalies.id, stored.id));
  }
}
