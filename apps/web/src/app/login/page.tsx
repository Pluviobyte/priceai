import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark, SITE_NAME, SITE_TAGLINE } from "../site-brand";

export const metadata: Metadata = { title: `登录 ${SITE_NAME}` };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const next = Array.isArray(raw.next) ? raw.next[0] : raw.next;
  const error = Array.isArray(raw.error) ? raw.error[0] : raw.error;
  return <main className="priceai-login-page"><section><Link className="priceai-login-brand" href="/"><BrandMark size={38} /><span><b>{SITE_NAME}</b><small>{SITE_TAGLINE}</small></span></Link><h1>登录 {SITE_NAME}</h1><p>当前账户入口连接现有审核后台，会话保存在 HttpOnly Cookie 中。</p>{error && <div className="form-error">账号或密码错误，或服务端尚未配置登录密钥。</div>}<form action="/api/admin/session" method="post"><label>管理账号<input name="username" minLength={2} maxLength={80} defaultValue="admin" autoComplete="username" required /></label><label>密码<input type="password" name="password" minLength={12} placeholder="输入管理员密码" autoComplete="current-password" required /></label><input type="hidden" name="next" value={next ?? "/"} /><button type="submit">登录</button></form><Link className="priceai-login-back" href="/">← 返回首页</Link></section></main>;
}
