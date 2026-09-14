import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/database-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const databaseHealthy = await checkDatabaseHealth();
  return NextResponse.json({
    status: databaseHealthy ? "ok" : "degraded",
    database: databaseHealthy ? "ok" : "unavailable",
    service: "web",
    release: process.env.PRICEAI_RELEASE_ID ?? "development",
    timestamp: new Date().toISOString(),
  }, {
    status: databaseHealthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
