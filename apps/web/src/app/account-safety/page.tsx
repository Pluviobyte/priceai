import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "../guides/guide-shell";

export const metadata: Metadata = {
  title: "AI 账号防封指南：为什么会被封、怎么降低风险、被封后怎么办 | PriceAI",
  description: "ChatGPT、Claude、Gemini、Grok 账号被封的常见原因，不同购买方式的风险差异，日常使用的安全习惯，以及被封后的申诉和售后处理。",
};

const toc = [
  { id: "causes", label: "账号为什么会被封" },
  { id: "by-route", label: "不同购买方式的风险" },
  { id: "before-buy", label: "购买前检查" },
  { id: "daily", label: "日常使用习惯" },
  { id: "banned", label: "被封或掉订阅后怎么办" },
];

export default function AccountSafetyPage() {
  return <GuideShell toc={toc} currentSlug="account-safety">
    <h1>账号防封指南</h1>
    <p className="lead">没有任何办法能保证账号永远不被封。能做的是弄清楚封号的常见原因，选风险更低的获取方式，并保留出问题时追责和申诉所需的凭证。</p>

    <h2 id="causes">账号为什么会被封</h2>
    <p>各家厂商的服务条款写法不同，但触发封禁或取消订阅的原因高度相似：</p>
    <ul>
      <li><strong>付款来源有问题：</strong>订阅用的银行卡被拒付、被盗刷或被发卡行撤销，厂商会取消订阅，严重时封禁账号。低价代充最常见的风险就在这里。</li>
      <li><strong>多人共用：</strong>同一账号在不同地区、不同设备上同时登录，容易被识别为账号共享或转售。</li>
      <li><strong>不支持的地区：</strong>从厂商未开放服务的地区直接使用，或账户资料与使用位置长期不一致。</li>
      <li><strong>自动化与批量使用：</strong>把网页订阅接入反代、号池或批量脚本，属于大多数厂商明确禁止的用法。</li>
      <li><strong>内容违规：</strong>违反使用政策的请求会导致警告乃至封禁，与购买渠道无关。</li>
    </ul>
    <aside className="priceai-doc-callout info"><b>●　先记住一件事</b><p>价格越低，背后的付款来源和使用方式通常越不可控。买之前先想清楚这个账号要用多久、出问题能接受什么结果。</p></aside>

    <h2 id="by-route">不同购买方式的风险</h2>
    <ul>
      <li><strong>官方自己付款：</strong>风险最低。账号、邮箱、订单都属于你，出问题直接找官方。</li>
      <li><strong>自己账号代充：</strong>账号是你的，但付款渠道由商家决定。付款来源一旦被追回，订阅会被取消，账号也可能受牵连。选择长期经营、写明“质保订阅期”的商家。</li>
      <li><strong>成品号：</strong>账号由商家注册，邮箱和找回方式最初不在你手里。很多成品号只“质保首登”，之后失效由你承担。</li>
      <li><strong>共享、镜像、反代：</strong>多人共用，最容易触发风控，也无法保护对话隐私。只适合临时、轻度使用。</li>
    </ul>
    <p>想了解各方式的价格差异，可以看 <Link href="/guides/why-ai-subscription-prices-differ">AI 订阅价格为什么差很多</Link>。</p>

    <h2 id="before-buy">购买前检查</h2>
    <ul>
      <li>商品标题写明期限、交付格式（账号密码、兑换码、充值到自己账号）和售后范围。</li>
      <li>区分“质保首登”和“质保订阅期”：前者只保证第一次能登录。</li>
      <li>价格远低于同规格其他报价时，确认不是日抛号、半价资格号或共享号。</li>
      <li>店铺有售后联系方式，所在发卡平台有投诉入口。PriceAI 报价旁显示店铺收录时长，可作为参考。</li>
      <li>第一次在一家店购买，先小额、短期试单。</li>
    </ul>

    <h2 id="daily">日常使用习惯</h2>
    <ul>
      <li><strong>拿回控制权：</strong>成品号到手后，尽快确认能修改密码、绑定自己的邮箱（若商家说明允许），并开启两步验证。</li>
      <li><strong>不要共享登录：</strong>不把账号密码或会话凭证交给他人，也不在陌生的网页工具里粘贴会话 token。</li>
      <li><strong>使用环境保持稳定：</strong>避免短时间内在多个国家或地区之间频繁切换登录位置，固定常用设备。</li>
      <li><strong>按条款使用：</strong>需要程序化调用时使用官方 API，而不是把网页订阅接进脚本或反代。</li>
      <li><strong>备份重要内容：</strong>定期导出重要对话和文件，账号失效时不至于全部丢失。</li>
    </ul>

    <h2 id="banned">被封或掉订阅后怎么办</h2>
    <ol>
      <li>确认原因：查看邮箱中厂商发来的通知，区分是订阅被取消（付款问题）还是账号被停用（政策问题）。</li>
      <li>自己付款的账号：通过厂商帮助中心提交申诉，说明使用情况并附上订单凭证。</li>
      <li>第三方购买的账号：保留订单号、付款记录和聊天截图，先联系店铺按约定质保处理；售后无响应时到发卡平台投诉。</li>
      <li>回到 PriceAI，在对应报价行点击举报并补充证据。核实后我们会下架异常商品，反复出现问题的店铺会停止收录。</li>
    </ol>
    <div className="priceai-doc-inline-actions"><Link href="/channels">查看同规格报价</Link><Link href="/guides/are-ai-subscription-card-shops-reliable">卡网渠道靠谱吗</Link><Link href="/official-prices">官方订阅价格</Link></div>
    <p className="priceai-doc-back"><Link href="/guides">← 返回指南目录</Link>　<Link href="/">返回 PriceAI 主站</Link></p>
  </GuideShell>;
}
