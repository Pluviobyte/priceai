import { databasePool } from "./database";

const TARGET_TABLES = {
  offer: "offers",
  merchant: "merchants",
} as const;

export async function createPublicReport(input: {
  targetType: keyof typeof TARGET_TABLES;
  targetId: string;
  reportType: string;
  details: string;
  evidenceUrl?: string;
  fingerprint: string;
}): Promise<string> {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const countResult = await client.query<{ count: string }>(
      `select count(*)::text count from reports
        where submitter_fingerprint=$1 and created_at > now() - interval '1 hour'`,
      [input.fingerprint],
    );
    if (Number(countResult.rows[0]?.count ?? 0) >= 10) throw new Error("report_rate_limited");
    const table = TARGET_TABLES[input.targetType];
    const targetResult = await client.query<{ exists: boolean }>(
      `select exists(select 1 from ${table} where id=$1) as exists`,
      [input.targetId],
    );
    if (!targetResult.rows[0]?.exists) throw new Error("report_target_not_found");
    const result = await client.query<{ id: string }>(
      `insert into reports
         (target_type,target_id,report_type,details,evidence_url,submitter_fingerprint,status)
       values ($1,$2,$3,$4,$5,$6,'open') returning id`,
      [
        input.targetType,
        input.targetId,
        input.reportType,
        input.details,
        input.evidenceUrl ?? null,
        input.fingerprint,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error("report_insert_failed");
    await client.query("commit");
    return id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
