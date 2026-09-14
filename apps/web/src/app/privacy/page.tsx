import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "账户隐私说明 | PriceAI" };
export default function PrivacyPage() {
  return <main className="priceai-login-page"><section><h1>账户隐私说明</h1>
    <p>更新日期：2026 年 9 月 14 日</p>
    <div className="priceai-privacy-copy"><p>使用 Google 或 GitHub 登录时，PriceAI 获取该平台的账户标识、显示名称和已验证的邮箱，用于识别登录身份与展示个人账户。</p>
      <p>我们不会读取你的 Gmail 邮件、GitHub 仓库或要求你向本站提供第三方账户密码。授权访问令牌仅用于本次身份核验，不保存在登录 Cookie 中。</p>
      <p>登录资料保存在加密、仅服务器可读取的 Cookie 中，最长保留 7 天；退出登录会清除当前浏览器的登录 Cookie。目前本站不将这些资料写入用户数据库，也不根据邮箱自动合并不同平台的账户。</p>
      <p>你可以在 Google 或 GitHub 的账户设置中撤销对 PriceAI 的授权。撤销授权后，也请在本站退出以清除已有会话。</p>
      <p>如对本站的数据使用有疑问，可通过<Link href="/support">联系与支持页面</Link>联系作者。</p></div>
    <Link className="priceai-login-back" href="/login">返回登录</Link></section></main>;
}
