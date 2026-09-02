import { createHash, randomBytes } from "node:crypto";
import { databasePool, query } from "./database";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function publicBaseUrl(): string {
  const value = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid_public_base_url");
  return url.origin;
}

export async function createPriceAlert(input: {
  productSlug: string;
  alertType: "price_drop" | "restock";
  email: string;
  targetPrice?: number;
  filters: Record<string, unknown>;
}): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const verificationToken = randomBytes(32).toString("base64url");
  const unsubscribeToken = randomBytes(32).toString("base64url");
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const productResult = await client.query<{ id: string; display_name: string }>(
      "select id,display_name from canonical_products where slug=$1 and status='active' limit 1",
      [input.productSlug],
    );
    const product = productResult.rows[0];
    if (!product) throw new Error("alert_product_not_found");
    const rateResult = await client.query<{ count: string }>(
      `select count(*)::text count from price_alerts
        where email=$1 and created_at > now() - interval '1 hour'`,
      [email],
    );
    if (Number(rateResult.rows[0]?.count ?? 0) >= 5) throw new Error("alert_rate_limited");
    const stateResult = await client.query<{ lowest_price: string | null; available: boolean }>(
      `select min(price) filter (where availability_state='purchasable') lowest_price,
              count(*) filter (where availability_state='purchasable') > 0 available
         from offers o join publication_channels pc on pc.current_generation_id=o.publish_generation_id
        where pc.channel='card_prices' and o.canonical_product_id=$1`,
      [product.id],
    );
    const state = stateResult.rows[0];
    const alertResult = await client.query<{ id: string }>(
      `insert into price_alerts
         (canonical_product_id,alert_type,email,target_price,filters,status,
          verification_token_hash,unsubscribe_token_hash,last_observed_price,last_observed_available)
       values ($1,$2,$3,$4,$5::jsonb,'pending_verification',$6,$7,$8,$9)
       returning id`,
      [
        product.id,
        input.alertType,
        email,
        input.targetPrice ?? null,
        JSON.stringify(input.filters),
        tokenHash(verificationToken),
        tokenHash(unsubscribeToken),
        state?.lowest_price ?? null,
        state?.available ?? false,
      ],
    );
    const alertId = alertResult.rows[0]?.id;
    if (!alertId) throw new Error("alert_insert_failed");
    const base = publicBaseUrl();
    const verificationUrl = `${base}/alerts/verify?token=${encodeURIComponent(verificationToken)}`;
    const unsubscribeUrl = `${base}/alerts/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    await client.query(
      `insert into notification_outbox (kind,destination,payload,status)
       values ('alert_verification',$1,$2::jsonb,'queued')`,
      [
        email,
        JSON.stringify({
          alertId,
          subject: `确认 ${product.display_name} 价格提醒`,
          text: `点击确认：${verificationUrl}\n取消提醒：${unsubscribeUrl}`,
          verificationUrl,
          unsubscribeUrl,
        }),
      ],
    );
    await client.query("commit");
    return alertId;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyPriceAlert(token: string): Promise<boolean> {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ id: string }>(
      `update price_alerts set status='active',confirmed_at=now(),updated_at=now()
        where verification_token_hash=$1 and status='pending_verification'
        returning id`,
      [tokenHash(token)],
    );
    const id = result.rows[0]?.id;
    if (id) {
      await client.query(
        `update notification_outbox set status='cancelled',updated_at=now()
          where kind='alert_verification' and status='queued' and payload->>'alertId'=$1`,
        [id],
      );
    }
    await client.query("commit");
    return Boolean(id);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function unsubscribePriceAlert(token: string): Promise<boolean> {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ id: string }>(
      `update price_alerts set status='cancelled',updated_at=now()
        where unsubscribe_token_hash=$1 and status in ('pending_verification','active')
        returning id`,
      [tokenHash(token)],
    );
    const id = result.rows[0]?.id;
    if (id) {
      await client.query(
        `update notification_outbox set status='cancelled',updated_at=now()
          where status='queued' and payload->>'alertId'=$1`,
        [id],
      );
    }
    await client.query("commit");
    return Boolean(id);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getAlertStatus(id: string): Promise<{ status: string; alertType: string } | null> {
  const [row] = await query<{ status: string; alert_type: string }>(
    "select status,alert_type from price_alerts where id=$1 limit 1",
    [id],
  );
  return row ? { status: row.status, alertType: row.alert_type } : null;
}
