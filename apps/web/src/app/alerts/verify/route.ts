import { NextResponse } from "next/server";
import { verifyPriceAlert } from "@/lib/public-alerts";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const verified = token && token.length <= 128 ? await verifyPriceAlert(token) : false;
  return NextResponse.redirect(new URL(verified ? "/alerts/verified" : "/alerts/verified?error=invalid", request.url), 303);
}
