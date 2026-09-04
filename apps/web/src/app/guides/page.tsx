import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "./guide-shell";

export const metadata: Metadata = { title: "PriceAI 快速入门：如何比价、判断渠道和选择购买路径 | PriceAI" };

const toc = [
  { id: "introduction", label: "1.1 快速入门", level: 2 as const },
  { id: "about", label: "什么是 PriceAI", level: 2 as const },
  { id: "use-priceai", label: "你可以怎么用 PriceAI", level: 2 as const },
  { id: "problems", label: "解决什么问题", level: 2 as const },
  { id: "features", label: "核心功能", level: 2 as const },
  { id: "paths", label: "购买路径分流", level: 3 as const },
  { id: "prices", label: "价格与库存对照", level: 3 as const },
  { id: "evidence", label: "来源与风险核验", level: 3 as const },
  { id: "verify", label: "购买前先核验", level: 2 as const },
  { id: "coverage", label: "支持的产品", level: 2 as const },
  { id: "principles", label: "数据原则", level: 2 as const },
  { id: "contribute", label: "参与完善 PriceAI", level: 2 as const },
  { id: "next-reading", label: "继续阅读", level: 2 as const },
];

export default function GuidesPage() {
  return <GuideShell toc={toc} currentSlug="getting-started">
    <h1 id="introduction">1.1 快速入门</h1>

    <h2 id="about">什么是 PriceAI</h2>
    <p>PriceAI 是一个面向 AI 用户和开发者的价格聚合工具。它把分散在官网、应用商店和第三方渠道里的订阅与 API 报价整理到同一处，并保留来源、库存、交付方式和更新时间。</p>
    <aside className="priceai-doc-callout info"><b>●　先记住一件事</b><p>PriceAI 是信息聚合工具，不是卖家背书。看到低价时，先看来源、交付方式、库存、更新时间和售后入口。</p></aside>

    <h2 id="use-priceai">你可以怎么用 PriceAI</h2>
    <div className="priceai-doc-paths">
      <Link href="/channels?stock=available"><span>01</span><div><strong>查第三方订阅渠道</strong><p>比较 ChatGPT、Claude、Gemini、Grok 等卡网渠道的价格、来源、库存和更新时间。</p></div><b aria-hidden="true">→</b></Link>
      <Link href="/official-prices"><span>02</span><div><strong>看官方订阅地区价</strong><p>了解官网价、地区价、支付方式、税费、汇率和账户地区，再判断是否适合自己。</p></div><b aria-hidden="true">→</b></Link>
      <Link href="/official-api"><span>03</span><div><strong>比较官方 API</strong><p>对照供应商、模型、计价方式和额度，先确认 API 是否适合自己的调用场景。</p></div><b aria-hidden="true">→</b></Link>
    </div>

    <h2 id="problems">解决什么问题</h2>
    <p>在购买 AI 服务时，你可能会遇到这些问题：</p>
    <ul>
      <li><strong>报价分散难比较：</strong>官网、卡网和中转站各自展示价格，需要反复打开页面核对。</li>
      <li><strong>交付方式容易混淆：</strong>官方订阅、代充、成品号、共享账号和 API 对应不同的账号归属与风险。</li>
      <li><strong>价格是否有效不清楚：</strong>低价可能已经缺货、过期，或者对应不同套餐和使用限制。</li>
      <li><strong>来源与售后难核验：</strong>只看到一个价格，无法判断商家、更新时间和投诉入口。</li>
    </ul>
    <p>PriceAI 通过统一的购买路径和可追溯报价解决这些问题。</p>

    <h2 id="features">核心功能</h2>

    <h3 id="paths">购买路径分流</h3>
    <ul>
      <li>区分官方订阅、第三方订阅、官方 API 与中转 API</li>
      <li>说明不同交付方式的账号归属、价格范围和主要代价</li>
      <li>根据自用、低价尝试或开发接入，引导进入对应专区</li>
    </ul>

    <h3 id="prices">价格与库存对照</h3>
    <ul>
      <li>对照官方人民币估价与渠道当前最低价</li>
      <li>标记库存状态、可用报价数量和最后验证时间</li>
      <li>不同期限、套餐与交付规格分开比较</li>
    </ul>

    <h3 id="evidence">来源与风险核验</h3>
    <ul>
      <li>保留原始商品标题、来源商家与原始链接</li>
      <li>展示售后条件、账号归属和已知风险事实</li>
      <li>提供纠错与举报入口，异常报价不参与最低价</li>
    </ul>

    <h2 id="verify">购买前先核验</h2>
    <p>跳转原渠道前，建议按下面的顺序快速检查：</p>
    <ol className="priceai-doc-checklist">
      <li><span>1</span><div><strong>确认商品规格</strong><p>核对原始商品名、账号归属、交付方式、期限和可用端。</p></div></li>
      <li><span>2</span><div><strong>确认价格仍然有效</strong><p>查看库存、更新时间、最终结算价和购买链接是否正常。</p></div></li>
      <li><span>3</span><div><strong>确认售后边界</strong><p>金额较大时，先联系卖家确认质保、退款条件和平台投诉入口。</p></div></li>
    </ol>
    <aside className="priceai-doc-callout warning"><b>▲　不要只看最低价</b><p>最低价可能对应不同账号、交付方式、有效期或售后条件。价格差异不是结论，来源和限制条件才是。</p></aside>

    <h2 id="coverage">支持的产品</h2>
    <div className="priceai-doc-table-wrap"><table>
      <thead><tr><th>类型</th><th>当前覆盖内容</th></tr></thead>
      <tbody>
        <tr><td>AI 订阅</td><td>ChatGPT、Claude、Gemini、Grok 等主流会员方案</td></tr>
        <tr><td>官方价格</td><td>官网、App Store、Google Play 的公开标价与地区差异</td></tr>
        <tr><td>第三方渠道</td><td>代充、成品账号、兑换码、团队席位、共享与镜像</td></tr>
        <tr><td>模型 API</td><td>OpenAI、Anthropic、Google、DeepSeek、千问、Kimi、GLM 等</td></tr>
      </tbody>
    </table></div>

    <h2 id="principles">数据原则</h2>
    <ul>
      <li><strong>不销售：</strong>PriceAI 不卖货、不收款，也不参与实际交付。</li>
      <li><strong>可追溯：</strong>每个价格都应能回到原始来源核验。</li>
      <li><strong>同规格比较：</strong>不同套餐、期限和账号归属不会混成一个最低价。</li>
      <li><strong>新鲜度优先：</strong>缺货、异常或长期未验证的报价不会作为当前可买价。</li>
    </ul>

    <h2 id="contribute">参与完善 PriceAI</h2>
    <p>发现商品价格、库存、链接或描述异常时，可以从商品详情页提交纠错。商家可以申请收录公开店铺与商品 Feed，平台建议和使用问题可以前往意见反馈。</p>
    <div className="priceai-doc-inline-actions"><Link href="/submit">申请收录</Link><Link href="/channels">举报问题商品</Link><Link href="/support">提交意见反馈</Link></div>

    <h2 id="next-reading">继续阅读</h2>
    <div className="priceai-doc-reading-list">
      <Link href="/guides/why-ai-subscription-prices-differ"><strong>AI 订阅价格为什么差很多</strong><span>拆开官网正价、地区价、资格价与渠道价。</span></Link>
      <Link href="/guides/are-ai-subscription-card-shops-reliable"><strong>卡网渠道靠谱吗</strong><span>学习下单前需要检查的来源与售后事实。</span></Link>
      <Link href="/guides/how-to-subscribe-ai-officially"><strong>如何自己完成官方订阅</strong><span>理解官网、应用商店和支付方式的官方路径。</span></Link>
      <Link href="/guides/chatgpt-subscription-options"><strong>ChatGPT 获取方式</strong><span>区分 Plus、Pro、Team、成品号与代充。</span></Link>
    </div>
  </GuideShell>;
}
