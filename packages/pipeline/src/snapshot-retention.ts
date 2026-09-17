export interface RetentionGeneration {
  id: string; channel: string | null; previous_generation_id: string | null;
  status: string; snapshot_state: string; snapshot_pinned: boolean;
  generated_at: Date; offer_count: number;
}
export interface RetentionPointer {
  channel: string; current_generation_id: string | null; previous_generation_id: string | null;
}
export interface RetentionPolicy {
  denseHours: number;
  checkpointDays: number;
  maxRetainedRows: number;
}

export function validateRetentionPolicy(policy: RetentionPolicy) {
  if (!Number.isFinite(policy.denseHours) || policy.denseHours < 1 ||
      !Number.isInteger(policy.checkpointDays) || policy.checkpointDays < 1 ||
      policy.checkpointDays * 24 < policy.denseHours ||
      !Number.isSafeInteger(policy.maxRetainedRows) || policy.maxRetainedRows < 1) {
    throw new Error('invalid_retention_policy');
  }
}

/** Metadata only. An unknown/ambiguous legacy lineage is protected, never guessed. */
export function planSnapshotRetention(generations: RetentionGeneration[], pointers: RetentionPointer[],
  policy: RetentionPolicy, now = new Date()) {
  validateRetentionPolicy(policy);
  const byId = new Map(generations.map(g => [g.id, g]));
  const channels = new Map<string, Set<string>>();
  const visit = (id: string | null, channel: string) => {
    const visited = new Set<string>();
    while (id && !visited.has(id)) {
      visited.add(id);
      const generation = byId.get(id);
      if (!generation) break;
      const owners = channels.get(id) ?? new Set<string>();
      if (owners.has(channel)) break;
      owners.add(channel); channels.set(id, owners);
      id = generation.previous_generation_id;
    }
  };
  for (const g of generations) if (g.channel) visit(g.id, g.channel);
  for (const p of pointers) { visit(p.current_generation_id, p.channel); visit(p.previous_generation_id, p.channel); }
  const keep = new Map<string, string>();
  for (const p of pointers) for (const id of [p.current_generation_id, p.previous_generation_id]) if (id) keep.set(id, 'live_pointer');
  const daily = new Set<string>();
  const ordered = [...generations].sort((a,b) => b.generated_at.getTime()-a.generated_at.getTime() || a.id.localeCompare(b.id));
  for (const g of ordered) {
    if (g.snapshot_state === 'pruned') continue;
    if (g.snapshot_pinned) keep.set(g.id, 'pinned');
    if (g.status !== 'superseded') keep.set(g.id, 'not_superseded');
    const owners = channels.get(g.id);
    if (!owners || owners.size !== 1) { keep.set(g.id, 'unknown_channel'); continue; }
    if (g.snapshot_state !== 'retained') continue; // Resume already marked pruning below.
    const age = now.getTime() - g.generated_at.getTime();
    if (age <= policy.denseHours * 3_600_000) keep.set(g.id, 'recent');
    if (age <= policy.checkpointDays * 86_400_000) {
      const key = `${[...owners][0]}:${g.generated_at.toISOString().slice(0,10)}`;
      if (!daily.has(key)) { keep.set(g.id, keep.get(g.id) ?? 'daily_checkpoint'); daily.add(key); }
    }
  }
  // One predecessor per retained version supports comparisons; do not recursively retain all history.
  for (const id of [...keep.keys()]) {
    const predecessor = byId.get(id)?.previous_generation_id;
    if (predecessor && byId.get(predecessor)?.snapshot_state === 'retained') keep.set(predecessor, keep.get(predecessor) ?? 'comparison_predecessor');
  }
  const retained = ordered.filter(g => keep.has(g.id) && g.snapshot_state !== 'pruned');
  const candidates = ordered.filter(g => !keep.has(g.id) && g.status === 'superseded' && ['retained','pruning'].includes(g.snapshot_state)).reverse();
  const estimatedRetainedRows = retained.reduce((sum,g) => sum+g.offer_count,0);
  return { retained: retained.map(g => ({id:g.id,reason:keep.get(g.id)!})),
    candidates: candidates.map(g => ({id:g.id,estimatedRows:g.offer_count,state:g.snapshot_state})),
    estimatedRetainedRows, estimatedCandidateRows: candidates.reduce((sum,g) => sum+g.offer_count,0),
    budgetExceeded: estimatedRetainedRows > policy.maxRetainedRows,
    // A capacity target never overrides a protected rollback point or a retention promise.
  };
}

interface RetentionConnection {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, any>[]; rowCount: number | null }>;
}

/** Caller supplies the host/vacuum guards. This transaction rechecks all protections per batch. */
export async function pruneSnapshotBatch(client: RetentionConnection, policy: RetentionPolicy, generationId: string) {
  try {
    await client.query('begin');
    await client.query("set local statement_timeout='3s'");
    await client.query("set local lock_timeout='200ms'");
    const lock=await client.query('select pg_try_advisory_xact_lock(718231,1) as acquired');
    if(!lock.rows[0]?.acquired) throw new Error('publication_busy_paused');
    const generations=await client.query('select id,channel,previous_generation_id,status,snapshot_state,snapshot_pinned,generated_at,offer_count from publish_generations');
    const pointers=await client.query('select channel,current_generation_id,previous_generation_id from publication_channels');
    const report=planSnapshotRetention(generations.rows as RetentionGeneration[],pointers.rows as RetentionPointer[],policy);
    if(report.budgetExceeded) throw new Error('retention_budget_requires_review');
    if(!report.candidates.some(g=>g.id===generationId)) throw new Error('generation_is_protected_or_complete');
    await client.query("update publish_generations set snapshot_state='pruning' where id=$1",[generationId]);
    const deleted=await client.query(`with batch as (
      select id from published_offer_snapshots where publish_generation_id=$1 limit 200
    ) delete from published_offer_snapshots s using batch where s.id=batch.id returning s.id`,[generationId]);
    const remaining=await client.query('select 1 from published_offer_snapshots where publish_generation_id=$1 limit 1',[generationId]);
    if(!remaining.rowCount) await client.query("update publish_generations set snapshot_state='pruned' where id=$1",[generationId]);
    await client.query(`insert into audit_logs(actor_id,action,target_type,target_id,reason,after_value)
      values('snapshot-retention','publication.snapshot_prune','publish_generation',$1,'bounded maintenance',$2::jsonb)`,
      [generationId,JSON.stringify({deleted:deleted.rowCount,complete:!remaining.rowCount,policy})]);
    await client.query('commit');
    return {deleted:deleted.rowCount,complete:!remaining.rowCount};
  } catch(error) { await client.query('rollback'); throw error; }
}
