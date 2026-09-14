import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginProviderReady, readUserToken, safeLoginNext, USER_COOKIE } from "@/lib/user-auth";
import { BrandMark, SITE_NAME, SITE_TAGLINE } from "../site-brand";
import { ProviderIcon } from "./provider-icon";

export const metadata: Metadata = { title: `登录 ${SITE_NAME}`, robots: { index: false, follow: false } };
const errors: Record<string, string> = {
  cancelled: "你已取消授权，可以重新选择登录方式。",
  expired: "本次登录已过期，请重新登录。",
  unavailable: "该登录方式暂未开放，请稍后再试。",
  failed: "暂时无法完成登录，请稍后重试。",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const next = safeLoginNext(Array.isArray(raw.next) ? raw.next[0] : raw.next);
  const error = Array.isArray(raw.error) ? raw.error[0] : raw.error;
  if (await readUserToken((await cookies()).get(USER_COOKIE)?.value)) redirect(next);
  return <main className="priceai-login-page"><section>
    <Link className="priceai-login-brand" href="/"><BrandMark size={38} /><span><b>{SITE_NAME}</b><small>{SITE_TAGLINE}</small></span></Link>
    <h1>欢迎来到 {SITE_NAME}</h1><p>选择你的账户，继续登录</p>
    {error && <div className="form-error" role="alert">{errors[error] ?? errors.failed}</div>}
    <div className="priceai-oauth-providers">
      {(["google", "github"] as const).map((provider) => {
        const ready = loginProviderReady(provider);
        return <form key={provider} action={`/api/auth/${provider}/start`} method="post">
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="priceai-oauth-button" disabled={!ready}>
            <ProviderIcon provider={provider} /><span>{provider === "google" ? "使用 Google（Gmail）登录" : "使用 GitHub 登录"}</span>
          </button>
          {!ready && <small className="priceai-oauth-unavailable">即将开放</small>}
        </form>;
      })}
    </div>
    <p className="priceai-oauth-note">无需设置新密码。我们仅使用基本账户资料识别你的身份。<Link href="/privacy">隐私说明</Link></p>
    <Link className="priceai-login-back" href="/">← 返回首页</Link>
  </section></main>;
}
