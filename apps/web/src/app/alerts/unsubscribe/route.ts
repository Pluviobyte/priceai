import { NextResponse } from "next/server";
import { unsubscribePriceAlert } from "@/lib/public-alerts";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const removed = token && token.length <= 128 ? await unsubscribePriceAlert(token) : false;
  return NextResponse.redirect(new URL(removed ? "/alerts/verified?unsubscribed=1" : "/alerts/verified?error=invalid", request.url), 303);
}
