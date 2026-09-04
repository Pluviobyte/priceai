import { getPublicAnnouncementConfig } from "@/lib/announcement-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getPublicAnnouncementConfig();
  return Response.json(config, {
    headers: { "Cache-Control": "no-store" },
  });
}
