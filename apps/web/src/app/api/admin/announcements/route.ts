import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminRequestSession, requestHasSameOrigin } from "@/lib/admin-auth";
import { saveAdminAnnouncement, saveAdminAnnouncementSettings } from "@/lib/admin-announcement-data";

const destinationUrl = z.string().trim().min(1).max(500).refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}, "invalid_destination_url");

const announcementSchema = z.object({
  id: z.string().uuid().optional(),
  badge: z.string().trim().min(1).max(20),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(120).optional(),
  actionLabel: z.string().trim().min(1).max(20),
  destinationUrl,
  kind: z.enum(["community", "service", "update"]),
  status: z.enum(["active", "paused", "archived"]),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

const settingsSchema = z.object({
  rotationEnabled: z.boolean(),
  rotationIntervalSeconds: z.coerce.number().int().min(4).max(15),
});

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const session = getAdminRequestSession(request);
  if (!session || !["system_admin", "operations"].includes(session.role)) return Response.json({ error: "forbidden" }, { status: 403 });

  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "settings") {
    const parsed = settingsSchema.safeParse({
      rotationEnabled: form.get("rotationEnabled") === "on",
      rotationIntervalSeconds: form.get("rotationIntervalSeconds"),
    });
    if (!parsed.success) return Response.json({ error: "invalid_announcement_settings" }, { status: 400 });
    await saveAdminAnnouncementSettings({ ...parsed.data, actorId: session.sub });
  } else {
    const parsed = announcementSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) return Response.json({ error: "invalid_announcement" }, { status: 400 });
    const { id, description, ...announcement } = parsed.data;
    await saveAdminAnnouncement({
      ...announcement,
      ...(id ? { id } : {}),
      ...(description ? { description } : {}),
      actorId: session.sub,
    });
  }

  return NextResponse.redirect(new URL("/admin/announcements", request.url), 303);
}
