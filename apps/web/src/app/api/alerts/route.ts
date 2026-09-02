import { NextResponse } from "next/server";
import { z } from "zod";
import { requestHasSameOrigin } from "@/lib/admin-auth";
import { createPriceAlert } from "@/lib/public-alerts";

const schema = z.object({
  productSlug: z.string().regex(/^[a-z0-9-]{2,100}$/),
  alertType: z.enum(["price_drop", "restock"]),
  email: z.email().max(320),
  targetPrice: z.string().optional(),
  filters: z.string().max(2_000).default("{}"),
  website: z.string().max(0),
});

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const form = await request.formData();
  const parsed = schema.safeParse({
    productSlug: form.get("productSlug"), alertType: form.get("alertType"),
    email: form.get("email"), targetPrice: form.get("targetPrice") || undefined,
    filters: form.get("filters") || "{}", website: form.get("website") ?? "",
  });
  if (!parsed.success) return Response.json({ error: "invalid_alert" }, { status: 400 });
  const targetPrice = parsed.data.targetPrice ? Number(parsed.data.targetPrice) : undefined;
  if (parsed.data.alertType === "price_drop" && (!targetPrice || targetPrice <= 0 || targetPrice > 1_000_000)) {
    return Response.json({ error: "invalid_target_price" }, { status: 400 });
  }
  let filters: Record<string, unknown>;
  try {
    const value = JSON.parse(parsed.data.filters) as unknown;
    filters = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { filters = {}; }
  try {
    const id = await createPriceAlert({
      productSlug: parsed.data.productSlug,
      alertType: parsed.data.alertType,
      email: parsed.data.email,
      ...(targetPrice ? { targetPrice } : {}),
      filters,
    });
    return NextResponse.redirect(new URL(`/alerts/status?id=${id}`, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "alert_create_failed";
    return Response.json({ error: message }, { status: message === "alert_rate_limited" ? 429 : 400 });
  }
}
