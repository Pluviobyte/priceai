import { createHmac } from "node:crypto";
import { databasePool, query } from "./database";

export interface PublicSubmissionStatus {
  id: string;
  url: string;
  name: string | null;
  status: string;
  detectedCollectorKind: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SubmissionStatusRow {
  id: string;
  url: string;
  name: string | null;
  status: string;
  detected_collector_kind: string | null;
  created_at: Date;
  updated_at: Date;
}

function fingerprintSecret(): string {
  const secret = process.env.FORM_FINGERPRINT_SECRET ?? process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("form_fingerprint_secret_not_configured");
  return secret;
}

export function submissionFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? forwarded ?? "unknown";
  const agent = request.headers.get("user-agent")?.slice(0, 240) ?? "unknown";
  return createHmac("sha256", fingerprintSecret())
    .update(`${address}\n${agent}`)
    .digest("hex");
}

export async function createPublicSourceSubmission(input: {
  url: string;
  name?: string;
  contact?: string;
  primaryProducts?: string;
  notes?: string;
  fingerprint: string;
  accountOwnerKey?: string | null;
}): Promise<{ id: string; status: string; duplicate: boolean }> {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const rateResult = await client.query<{ count: string }>(
      `select count(*)::text as count
         from source_submissions
        where submitter_fingerprint=$1 and created_at > now() - interval '1 hour'`,
      [input.fingerprint],
    );
    if (Number(rateResult.rows[0]?.count ?? 0) >= 5) throw new Error("submission_rate_limited");

    const duplicateResult = await client.query<{ id: string; status: string }>(
      `select id,status from source_submissions
        where url=$1 and created_at > now() - interval '30 days'
        order by created_at desc limit 1`,
      [input.url],
    );
    const duplicate = duplicateResult.rows[0];
    if (duplicate) {
      await client.query("commit");
      return { ...duplicate, duplicate: true };
    }

    const result = await client.query<{ id: string; status: string }>(
      `insert into source_submissions
         (url,name,contact,primary_products,notes,submitter_fingerprint,status,account_owner_key)
       values ($1,$2,$3,$4,$5,$6,'submitted',$7)
       returning id,status`,
      [
        input.url,
        input.name ?? null,
        input.contact ?? null,
        input.primaryProducts ?? null,
        input.notes ?? null,
        input.fingerprint,
        input.accountOwnerKey ?? null,
      ],
    );
    const created = result.rows[0];
    if (!created) throw new Error("source_submission_insert_failed");
    await client.query(
      `insert into source_candidates(candidate_url,merchant_name_hint,discovery_kind,submitted_by,status,review_note)
       values($1,$2,'user_submission','public_form','submitted_for_precheck',$3)`,
      [input.url, input.name ?? null, `source_submission:${created.id}`],
    );
    await client.query("commit");
    return { ...created, duplicate: false };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPublicSubmissionStatus(
  id: string,
): Promise<PublicSubmissionStatus | null> {
  const [row] = await query<SubmissionStatusRow>(
    `select id,url,name,status,detected_collector_kind,created_at,updated_at
       from source_submissions where id=$1 limit 1`,
    [id],
  );
  return row ? {
    id: row.id,
    url: row.url,
    name: row.name,
    status: row.status,
    detectedCollectorKind: row.detected_collector_kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } : null;
}

export async function createMerchantFeedApplication(input: {
  merchantName: string; websiteUrl: string; feedUrl: string; schemaKind: string;
  contact: string; notes?: string; fingerprint: string;
  accountOwnerKey?: string | null;
}): Promise<string> {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const rate = await client.query<{ count: string }>(
      `select ((select count(*) from source_submissions where submitter_fingerprint=$1 and created_at>now()-interval '1 hour')+
               (select count(*) from merchant_feed_submissions where submitter_fingerprint=$1 and created_at>now()-interval '1 hour'))::text count`,
      [input.fingerprint],
    );
    if (Number(rate.rows[0]?.count ?? 0) >= 5) throw new Error("submission_rate_limited");
    const duplicate = await client.query<{ id: string }>("select id from source_submissions where url=$1 and created_at>now()-interval '30 days' order by created_at desc limit 1", [input.feedUrl]);
    if (duplicate.rows[0]) { await client.query("commit"); return duplicate.rows[0].id; }
    const submission = await client.query<{ id: string }>(
      `insert into source_submissions(url,name,contact,primary_products,notes,submitter_fingerprint,status,account_owner_key)
       values($1,$2,$3,'merchant_feed',$4,$5,'submitted',$6) returning id`,
      [input.feedUrl, input.merchantName, input.contact, input.notes ?? null, input.fingerprint, input.accountOwnerKey ?? null],
    );
    const id = submission.rows[0]?.id;
    if (!id) throw new Error("feed_submission_insert_failed");
    await client.query(
      `insert into merchant_feed_submissions(merchant_name,website_url,feed_url,schema_kind,contact,notes,submitter_fingerprint,status,account_owner_key)
       values($1,$2,$3,$4,$5,$6,$7,'submitted',$8)`,
      [input.merchantName, input.websiteUrl, input.feedUrl, input.schemaKind, input.contact, input.notes ?? null, input.fingerprint, input.accountOwnerKey ?? null],
    );
    await client.query(
      `insert into source_candidates(candidate_url,merchant_name_hint,discovery_kind,submitted_by,status,review_note)
       values($1,$2,'merchant_feed','merchant','submitted_for_precheck',$3)`,
      [input.feedUrl, input.merchantName, `source_submission:${id}`],
    );
    await client.query("commit");
    return id;
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
