import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { PriceBaselineHero, PriceBaselineTable } from "./blue-price-engine";
import { ModelIcon, type ModelIconName } from "./model-icons";
import { getHomeSnapshot } from "@/lib/home-snapshot";

export const dynamic = "force-dynamic";

/**
 * 差价的来源。组织轴是「账号最后归谁」，不是「你是什么用户」——
 * 用户不必先给自己贴标签，只需要认出自己愿意接受哪一种交付形态。
 * 前四档按账号归属解释订阅差价，API 单独作为按调用量付费的路径。
 */
const deliveryFamilies = [
  {
    icon: "badge",
    title: "官网自己付款",
    ownership: "账号完全属于你",
    band: "官方正价",
    cost: "需要可用的海外支付方式与网络环境。自持最高管理权限，使用最稳妥。",
    href: "/official-prices",
    cta: "看官方价与地区价",
  },
  {
    icon: "shield",
    title: "代充 · 卡网",
    ownership: "你的账号，别人替你付款",
    band: "约为官方价的 5–8 折",
    cost: "需提取账号 Session 或交由对方代付，渠道异常可能波及订阅。下单时尽量选择信誉卡网与有售后保障的商家。",
    href: "/channels",
    cta: "去卡网订阅找代充",
  },
  {
    icon: "package",
    title: "成品账号 · 卡网",
    ownership: "对方建好后交给你",
    band: "约为官方价的 3–7 折",
    cost: "拍下即得新账号密码或官方兑换码，开箱即用。免去注册门槛，质保以各商家承诺期限为准。",
    href: "/channels",
    cta: "去卡网订阅找成品号",
  },
  {
    icon: "users",
    title: "共享 · 镜像 · 反代",
    ownership: "账号不归你，你买的是使用权",
    band: "约为官方价的 1–4 折",
    cost: "多人共用账号或镜像，可用额度会随人数分摊而相应减少。单价极低、开箱即用，适合轻度尝鲜与短期临时使用。",
    href: "/channels",
    cta: "去卡网订阅找共享类",
  },
  {
    icon: "database",
    title: "API",
    ownership: "不购买账号，按实际调用量付费",
    band: "按 Token / 请求计费",
    cost: "适合开发接入、批量处理和自动化。需要比较模型覆盖、计费倍率、稳定性、延迟与数据使用边界。",
    href: "/official-api",
    cta: "比较 API 价格",
  },
] as const;

/** 频道入口。按「你要买的东西」组织，不按用户身份组织。 */
const channels = [
  { icon: "package", need: "我要一个能自己登录的会员账号", title: "卡网订阅", text: "第三方渠道的会员、成品号、兑换码和席位。看有货价、交付方式和最后确认时间。", href: "/channels" },
  { icon: "badge", need: "我想先知道官网到底收多少钱", title: "官方订阅", text: "厂商公开页面的正价、地区价和资格价，标明币种、汇率日期和证据链接。", href: "/official-prices" },
  { icon: "database", need: "我要按用量付费的模型接口", title: "官方 API", text: "各厂商官方 API 的计费单价、免费额度和速率限制，按模型逐条对照。", href: "/official-api" },
  { icon: "key", need: "我想用更便宜的第三方接口", title: "中转 API", text: "第三方中转站的倍率、近期成功率、延迟和样本量，以及它们披露了多少信息。", href: "/api-transit" },
] as const;

const modelFamilies: Array<{ icon: ModelIconName; label: string }> = [
  { icon: "openai", label: "ChatGPT" },
  { icon: "claude", label: "Claude" },
  { icon: "gemini", label: "Gemini" },
  { icon: "grok", label: "Grok" },
  { icon: "deepseek", label: "DeepSeek" },
  { icon: "qwen", label: "Qwen" },
  { icon: "kimi", label: "Kimi" },
  { icon: "zhipu", label: "GLM" },
];

const weDo = [
  "记录每条报价的原始标题、原始价格文本、来源渠道和确认时间。",
  "官方价单独取自厂商公开页面，只有精确价参与对照，区间价不参与最低价。",
  "标注库存状态和最后一次确认时间，长期未更新的报价不当作可买价。",
  "保留纠错和举报入口，证据成立后下架异常报价或整个渠道。",
];

const weDont = [
  "不销售、不代收款、不参与任何环节的交付。",
  "不给渠道做信用背书；采集连通性良好不等于商家可靠。",
  "不把不同交付方式混在一起凑出更好看的最低价。",
  "不隐藏风险事实，让某条报价显得比实际更划算。",
];

const faqs = [
  ["表里的最低价，我现在就能买到吗？", "最低价只统计 24 小时内验证过、且标记为有货的报价。但从我们采集到你下单之间仍有时间差，价格和库存最终以原站为准。发现不一致时，可以在商品页提交纠错。"],
  ["为什么同一个订阅能差三四倍？", "因为交付方式不同。代充、成品号、共享号和 API 交付给你的东西不是一回事，账号归属和售后能力也不同。上面「差价的来源」列了五种形态各自的价位和代价。"],
  ["你们收渠道的钱吗？", "页面上有明确标注的赞助位。赞助不改变排序、不影响最低价计算，也不会让某条报价被优先展示。完整的排序和计算规则写在数据说明页。"],
  ["第一次买，应该从哪种方式开始？", "建议从官方订阅或代充开始，账号在你自己手上，出问题可控。价格敏感再考虑成品号，并尽量先小额试单。共享和反代更适合只做临时验证的场景。"],
  ["买到货不对板怎么办？", "先走原平台的售后流程——交易关系在你和商家之间。同时可以在商品页提交纠错并附上截图；证据成立后我们会下架该报价，反复出问题的渠道会整体停止收录。"],
] as const;

function LineIcon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const glyphs: Record<string, ReactNode> = {
    shield: <><path d="M20 13c0 5-3.5 7.5-7.7 9C8 20.5 4 18 4 13V6c3 0 6-1.5 8-3 2 1.5 5 3 8 3z" /><path d="m9 12 2 2 4-4" /></>,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3M21 5v3M3 12c0 1.7 4 3 9 3M21 12l-3 5h4l-3 5" /></>,
    package: <><path d="M12 22V12M3.3 7 12 12l8.7-5M4 6l7-4a2 2 0 0 1 2 0l7 4a2 2 0 0 1 1 1.7v3.4M3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0" /><path d="m16 17 2 2 4-4" /></>,
    badge: <><path d="M3.9 8.6a4 4 0 0 1 4.7-4.7 4 4 0 0 1 6.8 0 4 4 0 0 1 4.7 4.7 4 4 0 0 1 0 6.8 4 4 0 0 1-4.7 4.7 4 4 0 0 1-6.8 0 4 4 0 0 1-4.7-4.7 4 4 0 0 1 0-6.8z" /><path d="m9 12 2 2 4-4" /></>,
    key: <><path d="M2.6 17.4A2 2 0 0 0 2 18.8V21h4v-1a1 1 0 0 1 1-1h2v-2h2.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4z" /><circle cx="16.5" cy="7.5" r=".5" fill="currentColor" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" {...common} aria-hidden="true">{glyphs[name]}</svg>;
}

function Arrow() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>;
}

export default async function HomePage() {
  const snapshot = await getHomeSnapshot();

  return <div className="priceai-page"><SiteHeader /><main className="priceai-home">
    <PriceBaselineHero />

    <section className="priceai-delivery-section" id="delivery">
      <div className="priceai-container">
        <div className="priceai-section-heading">
          <p className="priceai-kicker">差价的来源</p>
          <h2>同一个 ChatGPT Plus 会员，为什么有人付全价，有人只要两折？</h2>
          <p>不是渠道谁更良心，价格差主要来自五种供货方式：从官方独享、他人代充，到现成号、共享使用与按量调用的 API，交付形态不同，价格自然不同。下面按「账号最终归谁」为你分类拆解：</p>
        </div>
        <div className="priceai-delivery-grid">
          {deliveryFamilies.map((item) => <article key={item.title}>
            <div className="priceai-card-top"><span className="priceai-icon"><LineIcon name={item.icon} /></span></div>
            <h3>{item.title}</h3>
            <span className="priceai-pill">{item.band}</span>
            <p className="priceai-delivery-own">{item.ownership}</p>
            <p>{item.cost}</p>
            <Link className="priceai-btn" href={item.href}>{item.cta} <Arrow /></Link>
          </article>)}
        </div>
        <p className="priceai-delivery-note">下面表格里的最低价可能来自其中任何一种。比价之前先确认你要哪一种——同规格才有可比性。</p>
      </div>
    </section>

    <PriceBaselineTable snapshot={snapshot} />

    <section className="priceai-module-section" id="channels">
      <div className="priceai-container">
        <div className="priceai-section-heading">
          <p className="priceai-kicker">四个频道</p>
          <h2>想清楚要哪种交付方式之后，去这里比价</h2>
          <p>按你要买的东西进入，不需要先判断自己算新手还是老手。</p>
        </div>
        <div className="priceai-module-grid">
          {channels.map((item) => <Link href={item.href} key={item.title}>
            <div><span className="priceai-icon"><LineIcon name={item.icon} /></span><Arrow /></div>
            <p className="priceai-module-need">{item.need}</p>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </Link>)}
        </div>
        <div className="priceai-brand-title">目前已纳入对照的会员与模型厂商</div>
        <div className="priceai-brand-grid">{modelFamilies.map(({ icon, label }) => <div key={icon}><ModelIcon name={icon} label={label} /><span>{label}</span></div>)}</div>
      </div>
    </section>

    <section className="priceai-boundary-section">
      <div className="priceai-container">
        <div className="priceai-section-heading">
          <p className="priceai-kicker">边界</p>
          <h2>这个站做什么，不做什么</h2>
          <p>我们只负责让每个数字可以被回看。交易发生在原平台，判断权在你手上。</p>
        </div>
        <div className="priceai-boundary-split">
          <article className="do">
            <h3>我们做</h3>
            <ul>{weDo.map((line) => <li key={line}>{line}</li>)}</ul>
          </article>
          <article className="dont">
            <h3>我们不做</h3>
            <ul>{weDont.map((line) => <li key={line}>{line}</li>)}</ul>
          </article>
        </div>
        <div className="priceai-return-card">
          <div><h3>完整的采集、归一和排序规则</h3><p>包括最低价怎么算、什么样的报价会被排除、异常数据怎么处理。</p></div>
          <Link className="priceai-btn" href="/methodology">看数据说明 <Arrow /></Link>
        </div>
      </div>
    </section>

    <section className="priceai-faq-section" id="faq">
      <div className="priceai-container">
        <div className="priceai-section-heading">
          <p className="priceai-kicker">常见问题</p>
          <h2>下单之前，这几条值得先看</h2>
          <p>只保留最容易造成实际损失的问题。更细的背景说明在指南里维护。</p>
        </div>
        <div className="priceai-faq-list">{faqs.map(([q, a]) => <article key={q}><h3>{q}</h3><p>{a}</p></article>)}</div>
      </div>
    </section>
  </main><SiteFooter /></div>;
}
