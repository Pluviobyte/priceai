import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { databasePool, query } from "./database";
import { readUserToken, USER_COOKIE, type UserSession } from "./user-auth";

export function accountKey(user: Pick<UserSession, "provider" | "id">) {
  return createHash("sha256").update(JSON.stringify([user.provider, user.id])).digest("hex");
}
export const nicknameSchema = z.string().trim().min(1, "请输入昵称").max(40, "昵称最多 40 个字符").regex(/^[^\p{Cc}\p{Cf}]+$/u, "昵称不能包含控制字符");
export const favoriteSchema = z.object({ kind: z.enum(["product", "merchant"]), slug: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/) });
export async function currentAccount() {
  return readUserToken((await cookies()).get(USER_COOKIE)?.value);
}
export async function displayName(user: UserSession) {
  const [profile] = await query<{ nickname: string }>("select nickname from account_profiles where owner_key=$1", [accountKey(user)]);
  return profile?.nickname ?? user.name;
}
export async function saveNickname(user: UserSession, value: unknown) {
  const nickname = nicknameSchema.parse(value);
  await query(`insert into account_profiles(owner_key,nickname) values($1,$2)
    on conflict(owner_key) do update set nickname=excluded.nickname,updated_at=now()`, [accountKey(user), nickname]);
}
export async function setFavorite(user: UserSession, input: unknown, saved: boolean) {
  const { kind, slug } = favoriteSchema.parse(input);
  const owner = accountKey(user);
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    // Serialize this account's mutations so the limit is reliable under concurrency.
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [owner]);
    if (!saved) {
      await client.query("delete from account_favorites where owner_key=$1 and kind=$2 and slug=$3", [owner, kind, slug]);
    } else {
      const table = kind === "product" ? "canonical_products" : "merchants";
      const target = await client.query(`select 1 from ${table} where slug=$1 and status='active'`, [slug]);
      if (!target.rowCount) throw new Error("收藏对象已不可用");
      const existing = await client.query("select 1 from account_favorites where owner_key=$1 and kind=$2 and slug=$3", [owner, kind, slug]);
      if (!existing.rowCount) {
        const count = await client.query("select count(*)::int total from account_favorites where owner_key=$1", [owner]);
        if (count.rows[0].total >= 200) throw new Error("最多收藏 200 项，请先移除部分收藏");
        await client.query("insert into account_favorites(owner_key,kind,slug) values($1,$2,$3) on conflict do nothing", [owner, kind, slug]);
      }
    }
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
export interface Favorite { id: string; kind: "product" | "merchant"; slug: string; name: string; available: boolean }
export async function accountFavorites(user: UserSession) {
  return query<Favorite>(`select f.id,f.kind,f.slug,coalesce(p.display_name,m.name,f.slug) name,
    coalesce(p.status='active',m.status='active',false) available from account_favorites f
    left join canonical_products p on f.kind='product' and p.slug=f.slug
    left join merchants m on f.kind='merchant' and m.slug=f.slug
    where f.owner_key=$1 order by f.created_at desc limit 200`, [accountKey(user)]);
}
export interface AccountSubmission { id: string; kind: string; title: string; status: string; created_at: Date }
export async function accountSubmissions(user: UserSession, page: number) {
  return query<AccountSubmission>(`select * from (
    select id,'shop' kind,coalesce(name,url) title,status::text,created_at from source_submissions where account_owner_key=$1
    union all
    select id,'report' kind,details title,status,created_at from reports where account_owner_key=$1
  ) entries order by created_at desc,id limit 21 offset $2`, [accountKey(user), (page-1)*20]);
}
