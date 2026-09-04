import { timingSafeEqual } from "node:crypto";
import * as databaseSchema from "@price-radar/database/schema";
import { refreshOfficialSubscriptionChannels } from "@price-radar/price-channels/subscriptions";
import { drizzle } from "drizzle-orm/node-postgres";
import { NextResponse } from "next/server";
import { databasePool } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretsMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

async function refresh(request: Request): Promise<NextResponse> {
  const databaseUrl = process.env.DATABASE_URL;
  const expectedSecret = process.env.OFFICIAL_PRICE_REFRESH_SECRET ?? process.env.CRON_SECRET;
  if (!databaseUrl || !expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "official_price_refresh_not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secretsMatch(providedSecret, expectedSecret)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const lockClient = await databasePool.connect();
  let acquired = false;
  try {
    const lock = await lockClient.query<{ acquired: boolean }>("select pg_try_advisory_lock($1) as acquired", [7410317]);
    acquired = lock.rows[0]?.acquired === true;
    if (!acquired) {
      return NextResponse.json(
        { ok: true, skipped: "refresh_already_running" },
        { headers: { "cache-control": "no-store" } },
      );
    }
    const refreshed = await refreshOfficialSubscriptionChannels(drizzle(databasePool, { schema: databaseSchema }));
    const result = { ok: true, refreshedAt: new Date().toISOString(), ...refreshed } as const;
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("official subscription refresh failed", error);
    return NextResponse.json(
      { ok: false, error: "official_price_refresh_failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  } finally {
    if (acquired) await lockClient.query("select pg_advisory_unlock($1)", [7410317]).catch(() => undefined);
    lockClient.release();
  }
}

export const GET = refresh;
export const POST = refresh;
