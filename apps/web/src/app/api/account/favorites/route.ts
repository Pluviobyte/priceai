import { accountKey, currentAccount, favoriteSchema, setFavorite } from "@/lib/account";
import { query } from "@/lib/database";
import { authOrigin } from "@/lib/user-auth";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const user = await currentAccount();
  if (!user) return Response.json({ signedIn: false, saved: false }, { headers });
  const input = favoriteSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!input.success) return Response.json({ error: "无效收藏" }, { status: 400, headers });
  const rows = await query("select 1 from account_favorites where owner_key=$1 and kind=$2 and slug=$3", [accountKey(user), input.data.kind, input.data.slug]);
  return Response.json({ signedIn: true, saved: rows.length > 0 }, { headers });
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== authOrigin()) return Response.json({ error: "请求来源不正确" }, { status: 403, headers });
  const user = await currentAccount();
  if (!user) return Response.json({ error: "请先登录再收藏" }, { status: 401, headers });
  try {
    const body = await request.json();
    if (typeof body.saved !== "boolean") throw new Error();
    await setFavorite(user, body, body.saved);
    return Response.json({ saved: body.saved }, { headers });
  } catch { return Response.json({ error: "操作失败，请检查收藏对象是否仍可用，或是否已达到 200 项上限" }, { status: 400, headers }); }
}
