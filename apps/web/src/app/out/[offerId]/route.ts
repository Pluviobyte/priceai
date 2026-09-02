import { NextResponse } from "next/server";
import { resolveOutboundOffer } from "@/lib/public-platform";

export async function GET(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(offerId)) return NextResponse.redirect(new URL("/", request.url), 302);
  const destination = await resolveOutboundOffer(offerId);
  if (!destination) return NextResponse.redirect(new URL("/", request.url), 302);
  const url = new URL(destination);
  if (url.protocol !== "http:" && url.protocol !== "https:") return NextResponse.redirect(new URL("/", request.url), 302);
  return NextResponse.redirect(url, 302);
}
