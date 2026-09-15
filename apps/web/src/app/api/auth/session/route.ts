import { displayName } from "@/lib/account";
import { cookies } from "next/headers";
import { readUserToken, USER_COOKIE } from "@/lib/user-auth";

export async function GET() {
  const user = await readUserToken((await cookies()).get(USER_COOKIE)?.value);
  const name = user ? await displayName(user).catch(() => user.name) : null;
  return Response.json({ user: user ? { name } : null }, { headers: { "Cache-Control": "private, no-store" } });
}
