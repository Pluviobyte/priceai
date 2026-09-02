import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminRequestSession, requestHasSameOrigin } from "@/lib/admin-auth";
import { saveAdminSponsorship } from "@/lib/admin-data";

const httpUrl = z.url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "http_url_required");
const schema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(120), position: z.enum(["home_after_hero", "product_sidebar"]), label: z.string().trim().min(1).max(30), destinationUrl: httpUrl, imageUrl: z.union([httpUrl, z.literal("")]).optional(), disclosure: z.string().trim().min(4).max(500), startsAt: z.coerce.date(), endsAt: z.coerce.date(), status: z.enum(["draft", "active", "paused", "archived"]) });

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const session = getAdminRequestSession(request);
  if (!session || !["system_admin", "operations"].includes(session.role)) return Response.json({ error: "forbidden" }, { status: 403 });
  const form = await request.formData(); const data = Object.fromEntries(form.entries()); const parsed = schema.safeParse(data);
  if (!parsed.success || parsed.data.endsAt <= parsed.data.startsAt) return Response.json({ error: "invalid_sponsorship" }, { status: 400 });
  const { id, imageUrl, ...required } = parsed.data;
  await saveAdminSponsorship({ ...required, ...(id ? { id } : {}), ...(imageUrl ? { imageUrl } : {}), actorId: session.sub });
  return NextResponse.redirect(new URL("/admin/sponsorships", request.url), 303);
}
