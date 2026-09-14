import "server-only";
import { query } from "./database";
import {
  DEFAULT_ANNOUNCEMENT_CONFIG,
  communityAnnouncementTitle,
  type AnnouncementKind,
  type SiteAnnouncement,
  type SiteAnnouncementConfig,
} from "./site-announcements";

interface AnnouncementRow {
  id: string;
  badge: string;
  title: string;
  description: string | null;
  action_label: string;
  destination_url: string;
  kind: string;
}

export async function getPublicAnnouncementConfig(): Promise<SiteAnnouncementConfig> {
  try {
    const [announcements, settings] = await Promise.all([
      query<AnnouncementRow>(
        `select id,badge,title,description,action_label,destination_url,kind
           from site_announcements
          where status='active'
          order by sort_order asc,updated_at desc`,
      ),
      query<{ rotation_enabled: boolean; rotation_interval_seconds: number }>(
        `select rotation_enabled,rotation_interval_seconds
           from site_announcement_settings
          where key='global'
          limit 1`,
      ),
    ]);

    return {
      announcements: announcements.map((row): SiteAnnouncement => ({
        id: row.id,
        badge: row.badge,
        title: row.kind === "community" ? communityAnnouncementTitle(row.title) : row.title,
        description: row.description,
        actionLabel: row.action_label,
        destinationUrl: row.destination_url,
        kind: (["community", "service", "update"].includes(row.kind) ? row.kind : "update") as AnnouncementKind,
      })),
      rotationEnabled: settings[0]?.rotation_enabled ?? true,
      rotationIntervalMs: Math.min(15, Math.max(4, settings[0]?.rotation_interval_seconds ?? 4)) * 1_000,
    };
  } catch {
    // 数据库尚未迁移或暂时不可用时，首屏仍展示内置公告。
    return DEFAULT_ANNOUNCEMENT_CONFIG;
  }
}
