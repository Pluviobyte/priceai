import {sql} from 'drizzle-orm';
import type {Database} from '@price-radar/database';

/** Called inside the admission transaction, only AFTER its quality checks pass.
 * A source-owned complete trial is already a valid snapshot; never fetch it twice. */
export async function promoteApprovedTrial(db: Pick<Database, "execute">, sourceId: string, runId: string, nextRunAt: Date) {
  const {rows}=await db.execute(sql`update sources s set enabled=true,health_status='healthy',
    latest_complete_run_id=r.id,expected_product_count=r.expected_total,
    last_checked_at=r.finished_at,last_success_at=r.finished_at,last_error_code=null,
    consecutive_failures=0,next_run_at=${nextRunAt},updated_at=now()
    from crawl_runs r where s.id=${sourceId}::uuid and r.id=${runId}::uuid and r.source_id=s.id
      and r.complete_snapshot=true and r.status='success' and r.finished_at is not null
    returning s.id`);
  if(!rows.length) throw new Error('approved_trial_not_complete_or_source_mismatch');
}
