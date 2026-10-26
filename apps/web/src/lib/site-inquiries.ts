import { databasePool, query } from "./database";

export const INQUIRY_KINDS = {
  feedback: "意见反馈",
  sponsor: "赞助与广告",
  wholesale: "批发合作",
  cooperation: "其他合作",
} as const;
export type InquiryKind = keyof typeof INQUIRY_KINDS;

export function inquiryKind(value: string | undefined | null): InquiryKind {
  return value && value in INQUIRY_KINDS ? value as InquiryKind : "feedback";
}

export async function createSiteInquiry(input: {
  kind: InquiryKind;
  name?: string;
  contact: string;
  message: string;
  fingerprint: string;
}): Promise<string> {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const recent = await client.query<{ count: string }>(
      `select count(*)::text count from site_inquiries
        where submitter_fingerprint=$1 and created_at > now() - interval '1 hour'`,
      [input.fingerprint],
    );
    if (Number(recent.rows[0]?.count ?? 0) >= 5) throw new Error("inquiry_rate_limited");
    const result = await client.query<{ id: string }>(
      `insert into site_inquiries (kind,name,contact,message,submitter_fingerprint)
       values ($1,$2,$3,$4,$5) returning id`,
      [input.kind, input.name ?? null, input.contact, input.message, input.fingerprint],
    );
    await client.query("commit");
    return result.rows[0]!.id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export interface SiteInquiry {
  id: string;
  kind: string;
  name: string | null;
  contact: string;
  message: string;
  status: string;
  createdAt: Date;
}

export async function getRecentSiteInquiries(limit = 200): Promise<SiteInquiry[]> {
  return query<SiteInquiry>(
    `select id,kind,name,contact,message,status,created_at "createdAt"
       from site_inquiries order by created_at desc limit $1`,
    [limit],
  );
}
