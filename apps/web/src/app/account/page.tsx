import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readUserToken, USER_COOKIE } from "@/lib/user-auth";
import { BrandMark, SITE_NAME, SITE_TAGLINE } from "../site-brand";
import { ProviderIcon } from "../login/provider-icon";

export const metadata: Metadata = { title: "个人账户 | PriceAI", robots: { index: false, follow: false } };
export default async function AccountPage() {
  const user = await readUserToken((await cookies()).get(USER_COOKIE)?.value);
  if (!user) redirect("/login?next=%2Faccount");
  return <main className="priceai-login-page"><section>
    <Link className="priceai-login-brand" href="/"><BrandMark size={38}/><span><b>{SITE_NAME}</b><small>{SITE_TAGLINE}</small></span></Link>
    <h1>个人账户</h1><p>你好，{user.name}</p>
    <dl className="priceai-account-details"><dt>登录方式</dt><dd><ProviderIcon provider={user.provider}/>{user.provider === "google" ? "Google" : "GitHub"}</dd><dt>邮箱</dt><dd>{user.email ?? "未提供已验证的邮箱"}</dd></dl>
    <form action="/api/auth/logout" method="post"><button type="submit">退出登录</button></form>
    <Link className="priceai-login-back" href="/">← 返回首页</Link>
  </section></main>;
}
