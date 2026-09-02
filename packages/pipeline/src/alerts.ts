import { createHash, createHmac, randomBytes } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import {
  notificationOutbox,
  priceAlerts,
  type Database,
} from "@price-radar/database";

interface ActiveAlertRow extends Record<string, unknown> {
  id: string;
  canonical_product_id: string;
  product_name: string;
  product_slug: string;
  alert_type: string;
  email: string;
  target_price: string | null;
  filters: Record<string, unknown>;
  last_observed_price: string | null;
  last_observed_available: boolean | null;
}

interface AlertOfferRow extends Record<string, unknown> {
  canonical_product_id: string;
  price: string;
  offer_mode: string;
  duration_days: number | null;
  warranty_type: string | null;
  account_ownership: string | null;
  phone_bound: boolean | null;
  shared: boolean | null;
}

function matchesFilter(offer: AlertOfferRow, filters: Record<string, unknown>): boolean {
  if (typeof filters.mode === "string" && filters.mode && offer.offer_mode !== filters.mode) return false;
  if (typeof filters.warranty === "string" && filters.warranty && offer.warranty_type !== filters.warranty) return false;
  if (typeof filters.ownership === "string" && filters.ownership && offer.account_ownership !== filters.ownership) return false;
  if (typeof filters.durationDays === "number" && offer.duration_days !== filters.durationDays) return false;
  if (filters.shared === "yes" && offer.shared !== true) return false;
  if (filters.shared === "no" && offer.shared === true) return false;
  if (filters.phoneBound === "yes" && offer.phone_bound !== true) return false;
  if (filters.phoneBound === "no" && offer.phone_bound !== false) return false;
  return true;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function trustedBaseUrl(): string {
  const url = new URL(process.env.PUBLIC_BASE_URL ?? "http://localhost:3000");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid_public_base_url");
  return url.origin;
}

export async function evaluatePriceAlerts(
  db: Database,
  generationId: string,
  now = new Date(),
): Promise<{ evaluated: number; triggered: number }> {
  const alertResult = await db.execute<ActiveAlertRow>(sql`
    select pa.id,pa.canonical_product_id,cp.display_name product_name,cp.slug product_slug,
           pa.alert_type,pa.email,pa.target_price,pa.filters,
           pa.last_observed_price,pa.last_observed_available
      from price_alerts pa join canonical_products cp on cp.id=pa.canonical_product_id
     where pa.status='active'
  `);
  const alerts = alertResult.rows;
  if (alerts.length === 0) return { evaluated: 0, triggered: 0 };
  const productIds = [...new Set(alerts.map((alert) => alert.canonical_product_id))];
  const offerResult = await db.execute<AlertOfferRow>(sql`
    select o.canonical_product_id,o.price,o.offer_mode,oa.duration_days,
           oa.warranty_type,oa.account_ownership,oa.phone_bound,oa.shared
      from offers o
      join raw_offer_snapshots ros on ros.id=o.latest_raw_snapshot_id
      join offer_matches om on om.raw_offer_snapshot_id=ros.id
      left join offer_attributes oa on oa.offer_match_id=om.id
     where o.publish_generation_id=${generationId}
       and o.availability_state='purchasable'
       and o.canonical_product_id in (${sql.join(productIds.map((id) => sql`${id}`), sql`,`)})
  `);
  const offerRows = offerResult.rows;
  const offersByProduct = new Map<string, AlertOfferRow[]>();
  for (const offer of offerRows) {
    const rows = offersByProduct.get(offer.canonical_product_id) ?? [];
    rows.push(offer);
    offersByProduct.set(offer.canonical_product_id, rows);
  }
  let triggered = 0;
  for (const alert of alerts) {
    const matching = (offersByProduct.get(alert.canonical_product_id) ?? [])
      .filter((offer) => matchesFilter(offer, alert.filters ?? {}))
      .sort((left, right) => Number(left.price) - Number(right.price));
    const lowest = matching[0]?.price ?? null;
    const available = matching.length > 0;
    const target = alert.target_price === null ? null : Number(alert.target_price);
    const shouldTrigger = alert.alert_type === "price_drop"
      ? lowest !== null && target !== null && Number(lowest) <= target &&
        (alert.last_observed_price === null || Number(alert.last_observed_price) > target)
      : available && alert.last_observed_available === false;
    if (!shouldTrigger) {
      await db
        .update(priceAlerts)
        .set({ lastObservedPrice: lowest, lastObservedAvailable: available, updatedAt: now })
        .where(eq(priceAlerts.id, alert.id));
      continue;
    }
    const unsubscribeToken = randomBytes(32).toString("base64url");
    const productUrl = `${trustedBaseUrl()}/products/${encodeURIComponent(alert.product_slug)}`;
    const unsubscribeUrl = `${trustedBaseUrl()}/alerts/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    const description = alert.alert_type === "price_drop"
      ? `${alert.product_name} 当前匹配最低价为 ¥${Number(lowest).toFixed(2)}。`
      : `${alert.product_name} 已重新出现可购买报价。`;
    await db.transaction(async (tx) => {
      await tx
        .update(priceAlerts)
        .set({
          lastObservedPrice: lowest,
          lastObservedAvailable: available,
          lastTriggeredAt: now,
          unsubscribeTokenHash: tokenHash(unsubscribeToken),
          updatedAt: now,
        })
        .where(eq(priceAlerts.id, alert.id));
      await tx.insert(notificationOutbox).values({
        kind: alert.alert_type,
        destination: alert.email,
        payload: {
          alertId: alert.id,
          subject: `${alert.product_name} ${alert.alert_type === "price_drop" ? "降价" : "补货"}提醒`,
          text: `${description}\n查看：${productUrl}\n取消：${unsubscribeUrl}`,
          productUrl,
          unsubscribeUrl,
          ...(lowest !== null ? { price: lowest } : {}),
        },
      });
    });
    triggered += 1;
  }
  return { evaluated: alerts.length, triggered };
}

export interface NotificationWebhookConfig {
  url: string;
  secret: string;
  maxBatch?: number;
}

export async function deliverNotificationOutbox(
  db: Database,
  config: NotificationWebhookConfig,
  now = new Date(),
): Promise<{ attempted: number; sent: number }> {
  if (config.secret.length < 32) throw new Error("notification_webhook_secret_too_short");
  const webhook = new URL(config.url);
  if (webhook.protocol !== "https:" && webhook.hostname !== "localhost" && webhook.hostname !== "127.0.0.1") {
    throw new Error("notification_webhook_requires_https");
  }
  await db
    .update(notificationOutbox)
    .set({ status: "queued", updatedAt: now })
    .where(and(eq(notificationOutbox.status, "sending"), lte(notificationOutbox.updatedAt, new Date(now.getTime() - 15 * 60_000))));
  const candidates = await db
    .select()
    .from(notificationOutbox)
    .where(and(eq(notificationOutbox.status, "queued"), lte(notificationOutbox.availableAt, now)))
    .limit(config.maxBatch ?? 20);
  let attempted = 0;
  let sent = 0;
  for (const candidate of candidates) {
    const [claimed] = await db
      .update(notificationOutbox)
      .set({ status: "sending", attempts: candidate.attempts + 1, updatedAt: now })
      .where(and(eq(notificationOutbox.id, candidate.id), eq(notificationOutbox.status, "queued")))
      .returning({ id: notificationOutbox.id });
    if (!claimed) continue;
    attempted += 1;
    const body = JSON.stringify({
      id: candidate.id,
      kind: candidate.kind,
      destination: candidate.destination,
      payload: candidate.payload,
    });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(webhook, {
        method: "POST",
        redirect: "error",
        headers: {
          "content-type": "application/json",
          "x-price-radar-signature": createHmac("sha256", config.secret).update(body).digest("hex"),
        },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!response.ok) throw new Error(`notification_http_${response.status}`);
      await db
        .update(notificationOutbox)
        .set({ status: "sent", sentAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(eq(notificationOutbox.id, candidate.id));
      sent += 1;
    } catch (error) {
      const attempts = candidate.attempts + 1;
      const delayMs = Math.min(6 * 60 * 60_000, 30_000 * 2 ** Math.min(attempts, 8));
      await db
        .update(notificationOutbox)
        .set({
          status: attempts >= 10 ? "failed" : "queued",
          availableAt: new Date(Date.now() + delayMs),
          lastError: error instanceof Error ? error.message : "notification_failed",
          updatedAt: new Date(),
        })
        .where(eq(notificationOutbox.id, candidate.id));
    }
  }
  return { attempted, sent };
}
