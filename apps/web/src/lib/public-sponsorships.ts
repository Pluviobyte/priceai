import { query } from "./database";

export async function getActiveSponsorships(position: string) {
  return query<{ id: string; name: string; label: string; destination_url: string; image_url: string | null; disclosure: string }>("select id,name,label,destination_url,image_url,disclosure from sponsorship_placements where status='active' and position=$1 and starts_at<=now() and ends_at>now() order by starts_at limit 4", [position]);
}
