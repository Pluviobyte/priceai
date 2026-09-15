import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountFavorites, accountSubmissions, currentAccount, displayName } from "@/lib/account";
import { ProviderIcon } from "../login/provider-icon";
import { ProfileForm } from "./profile-form";
import { FavoriteButton } from "../favorite-button";

export const metadata: Metadata = { title: "个人中心 | PriceAI", robots: { index: false, follow: false } };
const tabs = [{ key: "profile", label: "个人资料" }, { key: "favorites", label: "我的收藏" }, { key: "submissions", label: "我的提交" }, { key: "settings", label: "账户设置" }];
const statuses: Record<string, string> = { submitted: "等待预检", prechecked: "预检完成", trial_crawled: "试采集完成", review: "等待审核", approved: "已通过", rejected: "未通过", open: "待处理", resolved: "已处理", dismissed: "已关闭" };
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const user = await currentAccount();
  if (!user) redirect("/login?next=%2Faccount");
  const params = await searchParams;
  const tab = tabs.find(item => item.key === params.tab) ?? tabs[0]!;
  const page = Math.min(10000, Math.max(1, Math.floor(Number(params.page) || 1)));
  const name = await displayName(user);
  const provider = user.provider === "google" ? "Google" : "GitHub";
  const favorites = tab.key === "favorites" ? await accountFavorites(user) : [];
  const submissions = tab.key === "submissions" ? await accountSubmissions(user, page) : [];
  return <main className="account-shell">
    <div className="account-heading"><div><span className="section-kicker">你的 PriceAI</span><h1>个人中心</h1></div><Link href="/channels">继续比价 →</Link></div>
    <div className="account-layout"><aside className="account-sidebar">
      <div className="account-identity"><span className="account-avatar" aria-hidden="true">{(Array.from(name)[0] ?? "我").toLocaleUpperCase()}</span><strong>{name}</strong><small><ProviderIcon provider={user.provider} />{provider} 已登录</small></div>
      <nav aria-label="个人中心栏目">{tabs.map(item => <Link key={item.key} href={`/account?tab=${item.key}`} aria-current={tab.key === item.key ? "page" : undefined}>{item.label}<span aria-hidden="true">›</span></Link>)}</nav>
    </aside><section className="account-content" aria-labelledby="account-section-title"><header><h2 id="account-section-title">{tab.label}</h2><p>{tab.key === "profile" ? "管理你在本站显示的个人资料。" : tab.key === "favorites" ? "把常看的商品和商家放在一起，随时回去比较。" : tab.key === "submissions" ? "查看你提交的店铺与报价纠错的处理状态。" : "查看登录身份，管理当前会话。"}</p></header>
      {tab.key === "profile" && <><ProfileForm name={name} /><dl className="account-info"><div><dt>邮箱</dt><dd>{user.email ?? "该平台未提供已验证的邮箱"}</dd></div><div><dt>登录来源</dt><dd><ProviderIcon provider={user.provider} />{provider}</dd></div></dl><p className="account-note">邮箱由登录平台提供；如需修改，请前往对应平台的账户设置。</p></>}
      {tab.key === "favorites" && <>{favorites.length ? <><p className="account-note">已收藏 {favorites.length} 项 / 最多 200 项</p><ul className="account-list">{favorites.map(item => <li key={item.id}><div><small>{item.kind === "product" ? "商品" : "商家"}</small>{item.available ? <Link href={`/${item.kind === "product" ? "products" : "merchants"}/${item.slug}`}>{item.name} →</Link> : <strong>{item.name}（已不可用）</strong>}</div><FavoriteButton kind={item.kind} slug={item.slug} initialSaved /></li>)}</ul></> : <div className="account-empty"><span aria-hidden="true">☆</span><h3>把值得再看的报价留下来</h3><p>在商品或商家详情页点击“收藏”，就能在这里找到。</p><Link className="account-primary" href="/channels">浏览商品与商家</Link></div>}</>}
      {tab.key === "submissions" && <><p className="account-note">仅显示登录后新提交的记录，历史匿名提交不会自动关联。重复店铺仍使用原投稿状态，不会认领他人的记录。</p>{submissions.length ? <ul className="account-list">{submissions.slice(0,20).map(item => <li key={`${item.kind}-${item.id}`}><div><small>{item.kind === "shop" ? "店铺投稿" : "报价与商家纠错"} · {new Date(item.created_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</small>{item.kind === "shop" ? <Link href={`/submit/status?id=${item.id}`}>{item.title} →</Link> : <p>{item.title}</p>}</div><span className="account-status">{statuses[item.status] ?? "处理中"}</span></li>)}</ul> : <div className="account-empty"><h3>分享你发现的好店铺</h3><p>提交公开店铺后，你可以在这里跟进收录进度。发现报价问题，也可以在报价旁提交纠错。</p><Link className="account-primary" href="/submit">提交店铺</Link></div>}{(page > 1 || submissions.length > 20) && <nav className="account-pagination" aria-label="提交记录分页">{page > 1 && <Link href={`/account?tab=submissions&page=${page-1}`}>← 上一页</Link>}<span>第 {page} 页</span>{submissions.length > 20 && <Link href={`/account?tab=submissions&page=${page+1}`}>下一页 →</Link>}</nav>}</>}
      {tab.key === "settings" && <><dl className="account-info"><div><dt>登录方式</dt><dd><ProviderIcon provider={user.provider}/>{provider}</dd></div><div><dt>邮箱</dt><dd>{user.email ?? "未提供"}</dd></div><div><dt>登录状态</dt><dd>当前浏览器已登录</dd></div></dl><p className="account-note">本站不设置独立密码。Google 与 GitHub 是不同账户，收藏和昵称分别保存。</p><div className="account-settings-links"><a href={user.provider === "google" ? "https://myaccount.google.com/permissions" : "https://github.com/settings/applications"} target="_blank" rel="noopener noreferrer">管理 {provider} 授权 ↗</a><Link href="/privacy">账户隐私说明 →</Link></div><div className="account-signout"><h3>退出当前账户</h3><p>退出后可重新选择登录方式，已保存的昵称和收藏会保留。</p><form action="/api/auth/logout" method="post"><button className="account-secondary">退出登录</button></form></div></>}
    </section></div>
  </main>;
}
