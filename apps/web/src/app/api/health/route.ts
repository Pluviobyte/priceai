import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "web",
    release: process.env.PRICEAI_RELEASE_ID ?? "development",
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
