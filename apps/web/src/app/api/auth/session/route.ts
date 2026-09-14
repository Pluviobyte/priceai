import { cookies } from "next/headers";
import { readUserToken, USER_COOKIE } from "@/lib/user-auth";

export async function GET() {
  const user = await readUserToken((await cookies()).get(USER_COOKIE)?.value);
  return Response.json({ user: user ? { name: user.name } : null }, { headers: { "Cache-Control": "private, no-store" } });
}
