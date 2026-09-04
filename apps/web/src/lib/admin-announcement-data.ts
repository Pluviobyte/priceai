import "server-only";
import { databasePool, query } from "./database";
import type { AnnouncementKind } from "./site-announcements";

export interface AdminAnnouncement {
  id: string;
  badge: string;
  title: string;
  description: string | null;
  actionLabel: string;
  destinationUrl: string;
  kind: AnnouncementKind;
  status: "active" | "paused" | "archived";
  sortOrder: number;
  updatedAt: Date;
}

export interface AdminAnnouncementSettings {
  rotationEnabled: boolean;
  rotationIntervalSeconds: number;
}

export async function getAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  const rows = await query<{
    id: string;
    badge: string;
    title: string;
    description: string | null;
    action_label: string;
    destination_url: string;
    kind: AnnouncementKind;
    status: "active" | "paused" | "archived";
    sort_order: number;
    updated_at: Date;
  }>(
    `select id,badge,title,description,action_label,destination_url,kind,status,sort_order,updated_at
       from site_announcements
      order by sort_order asc,updated_at desc`,
  );
  return rows.map((row) => ({
    id: row.id,
    badge: row.badge,
    title: row.title,
    description: row.description,
    actionLabel: row.action_label,
    destinationUrl: row.destination_url,
    kind: row.kind,
    status: row.status,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  }));
}

export async function getAdminAnnouncementSettings(): Promise<AdminAnnouncementSettings> {
  const rows = await query<{ rotation_enabled: boolean; rotation_interval_seconds: number }>(
    `select rotation_enabled,rotation_interval_seconds
       from site_announcement_settings
      where key='global'
      limit 1`,
  );
  return {
    rotationEnabled: rows[0]?.rotation_enabled ?? true,
    rotationIntervalSeconds: rows[0]?.rotation_interval_seconds ?? 4,
  };
}

export async function saveAdminAnnouncement(input: {
  id?: string;
  badge: string;
  title: string;
  description?: string;
  actionLabel: string;
  destinationUrl: string;
  kind: AnnouncementKind;
  status: "active" | "paused" | "archived";
  sortOrder: number;
  actorId: string;
}) {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const before = input.id
      ? (await client.query("select * from site_announcements where id=$1", [input.id])).rows[0] ?? null
      : null;
    const values = [input.badge, input.title, input.description || null, input.actionLabel, input.destinationUrl, input.kind, input.status, input.sortOrder];
    const result = input.id
      ? await client.query<{ id: string }>(
          `update site_announcements
              set badge=$2,title=$3,description=$4,action_label=$5,destination_url=$6,kind=$7,status=$8,sort_order=$9,updated_at=now()
            where id=$1 returning id`,
          [input.id, ...values],
        )
      : await client.query<{ id: string }>(
          `insert into site_announcements(badge,title,description,action_label,destination_url,kind,status,sort_order)
           values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          values,
        );
    const id = result.rows[0]?.id;
    if (!id) throw new Error("announcement_save_failed");
    const after = { ...input, id, actorId: undefined };
    await client.query(
      `insert into audit_logs(actor_id,action,target_type,target_id,reason,before_value,after_value)
       values($1,'announcement.save','site_announcement',$2,'admin announcement management',$3::jsonb,$4::jsonb)`,
      [input.actorId, id, JSON.stringify(before), JSON.stringify(after)],
    );
    await client.query("commit");
    return id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveAdminAnnouncementSettings(input: AdminAnnouncementSettings & { actorId: string }) {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const before = (await client.query("select * from site_announcement_settings where key='global'")).rows[0] ?? null;
    await client.query(
      `insert into site_announcement_settings(key,rotation_enabled,rotation_interval_seconds,updated_at)
       values('global',$1,$2,now())
       on conflict(key) do update set rotation_enabled=excluded.rotation_enabled,rotation_interval_seconds=excluded.rotation_interval_seconds,updated_at=now()`,
      [input.rotationEnabled, input.rotationIntervalSeconds],
    );
    await client.query(
      `insert into audit_logs(actor_id,action,target_type,target_id,reason,before_value,after_value)
       values($1,'announcement.settings','site_announcement_settings','global','admin announcement rotation settings',$2::jsonb,$3::jsonb)`,
      [input.actorId, JSON.stringify(before), JSON.stringify({ rotationEnabled: input.rotationEnabled, rotationIntervalSeconds: input.rotationIntervalSeconds })],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
