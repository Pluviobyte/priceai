import { currentAccount, saveNickname } from "@/lib/account";
import { authOrigin } from "@/lib/user-auth";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== authOrigin()) return Response.json({ error: "请求来源不正确" }, { status: 403 });
  const user = await currentAccount();
  if (!user) return Response.json({ error: "登录已过期，请重新登录" }, { status: 401 });
  try {
    const body = await request.json();
    await saveNickname(user, body.nickname);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "保存失败，请输入 1–40 个字符的昵称后重试" }, { status: 400 }); }
}
