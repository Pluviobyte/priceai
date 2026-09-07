import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "./site-footer";
import { PriceBaselineHero, PriceBaselineTable } from "./blue-price-engine";
import { ModelIcon, type ModelIconName } from "./model-icons";
import { getHomeSnapshot } from "@/lib/home-snapshot";

export const dynamic = "force-dynamic";

/**
 * 差价的来源。组织轴是「账号最后归谁」，不是「你是什么用户」——
 * 用户不必先给自己贴标签，只需要认出自己愿意接受哪一种交付形态。
 * 四档与 DELIVERY_FAMILY_OF 的分组一一对应。
 */
const deliveryFamilies = [
  {
    icon: "badge",
    tag: "稳定安全",
    tagTheme: "green",
    title: "官网自己付款",
    ownership: "账号完全属于你",
    band: "官方正价",
    cost: "需要可用的海外支付方式与网络环境。自持最高管理权限，使用最稳妥。",
    href: "/official-prices",
    cta: "看官方价与地区价",
  },
  {
    icon: "shield",
    tag: "免外币卡",
    tagTheme: "blue",
    title: "代充 · 卡网",
    ownership: "你的账号，别人替你付款",
    band: "约为官方价的 5–8 折",
    cost: "需提取账号 Session 或交由对方代付，渠道异常可能波及订阅。下单时尽量选择信誉卡网与有售后保障的商家。",
    href: "/channels",
    cta: "去卡网订阅找代充",
  },
  {
    icon: "package",
    tag: "开箱即用",
    tagTheme: "orange",
    title: "成品账号 · 卡网",
    ownership: "对方建好后交给你",
    band: "约为官方价的 3–7 折",
    cost: "拍下即得新账号密码或官方兑换码，开箱即用。免去注册门槛，质保以各商家承诺期限为准。",
    href: "/channels",
    cta: "去卡网订阅找成品号",
  },
  {
    icon: "key",
    tag: "白菜价尝鲜",
    tagTheme: "purple",
    title: "共享 · 镜像 · 反代",
    ownership: "账号不归你，你买的是使用权",
    band: "约为官方价的 1–4 折",
    cost: "多人共用账号或镜像，可用额度会随人数分摊而相应减少。单价极低、开箱即用，适合轻度尝鲜与短期临时使用。",
    href: "/channels",
    cta: "去卡网订阅找共享类",
  },
] as const;

/** 购买路径分流卡片，直接对齐原版文案 */
const decisionPaths = [
  {
    icon: "shield",
    badge: "订阅新手",
    title: "我只是想买一个 AI 订阅",
    text: "先看官方价、地区价和支付门槛；如果需要现货、更低价或代开通，再去看卡网订阅。",
    primaryHref: "/official-prices",
    primaryCta: "先看官方订阅",
    secondaryHref: "/channels",
    secondaryCta: "再看卡网订阅",
  },
  {
    icon: "badge",
    badge: "资深买家",
    title: "我想找更低价或更灵活的方案",
    text: "先看卡网订阅里的低价现货、渠道和更新时间；如果要接 GPT、Claude、Gemini、Grok 等模型，再看中转 API。",
    primaryHref: "/channels",
    primaryCta: "看卡网订阅",
    secondaryHref: "/api-transit",
    secondaryCta: "看中转 API",
  },
  {
    icon: "database",
    badge: "开发接入",
    title: "我想接 API 做产品或工具",
    text: "先看 DeepSeek、千问、Kimi、GLM 等官方 API 的免费额度、Token Plan 和限制；再对比中转 API。",
    primaryHref: "/official-api",
    primaryCta: "比较官方 API",
    secondaryHref: "/api-transit",
    secondaryCta: "查看中转 API",
  },
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
  "完整留存全网抓取的原始标题、原币种价格、供货店铺与验证时间戳，确保数据全程可追溯。",
  "官方基准价一律实时采自厂商公开定价页，仅采纳精准单价参与换算，模糊区间价绝不计入行情。",
  "严谨标记实时库存与巡检时效，对脱销断货或长期未验证的历史陈旧报价，一律剔除出在售底价。",
  "常设开放纠错与用户举报通道，证据属实的虚假低价即刻下架，多次产生售后劣迹的渠道全站拉黑。",
];

const weDont = [
  "绝不自营商品、不经手任何代收代付，不介入买卖双方在原平台的实际交易与售后履约。",
  "绝不替任何第三方渠道做信誉担保；系统采集顺畅仅代表数据可通达，不等于商家百分之百靠谱。",
  "绝不打乱交付规格混淆比价；不会拿“多人共享”与“独享代充”混为一谈来拼凑虚假的全网低价。",
  "绝不因商业合作隐瞒事实；赞助广告位绝不干预真实底价算法与排名，绝不诱导误导买家。",
];

const faqs = [
  ["表里标的“最低价”，我现在点进去就能买到吗？", "最低价仅统计 24 小时内巡检验证过、且标记为有货的报价。但由于各卡网库存与价格波动频繁，从我们系统抓取到您实际点击下单之间存在短暂时间差，最终价格与有货状态以商家原站为准。若发现价格变动或缺货，可在商品页一键提交纠错。"],
  ["同样是 AI 会员，为什么各渠道价格能相差三四倍？", "因为交付形态与账号归属本质完全不同。官网直付、个人账号代充、成品现成号和多人共享，虽然都能用上 AI，但交到你手里的使用权限、隐私安全和质保周期截然不同。页面上方「差价的来源」对这四种形态各自的价位和代价有详细拆解。"],
  ["新手第一次买，建议从哪种方式入手？怎么防踩坑？", "建议优先选择“官方订阅”或“自己账号代充”——账号完全属于你，历史记录可留存，出问题最稳妥可控；预算有限再考虑成品号，且尽量先以单月小额试单，切忌贪便宜一次性买长期；共享号和镜像仅建议作为低频临时体验。下单前务必核对店铺客服与售后群，切勿私下微信/支付宝转账。"],
  ["收录的卡网靠谱吗？买到货不对板或被骗了怎么办？", "平台收录仅代表公开信息索引，不等于官方信用背书，交易关系在您与商家之间。如果遇到异常：第一步（挽损）第一时间联系店铺客服，并在对应发卡平台发起工单投诉，争取交易平台介入拦截退款；第二步（举报）返回本站商品页提交纠错举报并附上凭证截图。证据核实后我们会即刻下架异常商品，反复出现售后劣迹的渠道将全站拉黑、永久停止收录。"],
  ["你们自己卖号吗？会不会收商家的钱把他们排在前面？", "我们不卖货、不代收款，也坚决不收渠道的钱买排名。我们是一个纯粹的中立比价雷达。页面上仅设有明确标注的独立赞助广告位，赞助绝不影响价格排序、不干预最低价算法，更不会优先展示某条报价。全站统一的抓取与计算规则均公开写在数据说明页。"],
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

  return <div className="priceai-page"><main className="priceai-home">
    <PriceBaselineHero />

    <section className="priceai-module-section" id="channels">
      <div className="priceai-container">
        <div className="priceai-section-heading">
          <p className="priceai-kicker">购买路径</p>
          <h2>先回答一个问题：你现在要买什么？</h2>
          <p>首页只负责分流。具体价格、库存、来源和购买链接，回到对应工具页完成。</p>
        </div>
        <div className="priceai-module-grid">
          {decisionPaths.map((item) => (
            <article className="priceai-path-card" key={item.title}>
              <div className="priceai-path-top">
                <span className="priceai-icon"><LineIcon name={item.icon} /></span>
                <span className="priceai-pill">{item.badge}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <div className="priceai-path-actions">
                <Link className="priceai-btn primary" href={item.primaryHref}>{item.primaryCta} <Arrow /></Link>
                <Link className="priceai-btn" href={item.secondaryHref}>{item.secondaryCta}</Link>
              </div>
            </article>
          ))}
        </div>
        <div className="priceai-brand-title">目前已纳入对照的会员与模型厂商</div>
        <div className="priceai-brand-grid">{modelFamilies.map(({ icon, label }) => <div key={icon}><ModelIcon name={icon} label={label} /><span>{label}</span></div>)}</div>
      </div>
    </section>

    <section className="priceai-delivery-section" id="delivery">
      <div className="priceai-container">
        <div className="priceai-section-heading">
          <p className="priceai-kicker">差价的来源</p>
          <h2>同一个 ChatGPT Plus 会员，为什么有人付全价，有人只要两折？</h2>
          <p>不是渠道谁更良心，价格差主要来自四种供货方式：从官方独享、他人代充，到现成号与共享使用，交付形态不同，价格自然不同。下面按「账号最终归谁」为你分类拆解：</p>
        </div>
        <div className="priceai-delivery-grid">
          {deliveryFamilies.map((item) => <article key={item.title}>
            <div className="priceai-card-top">
              <span className="priceai-icon"><LineIcon name={item.icon} /></span>
              <span className={`priceai-emotion-tag ${item.tagTheme}`}>{item.tag}</span>
            </div>
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

    <section className="priceai-boundary-section">
      <div className="priceai-container">
        <div className="priceai-section-heading">
          <p className="priceai-kicker">平台准则</p>
          <h2>我们坚持做什么，坚决不做什么</h2>
          <p>数据只讲客观事实，买家掌握最终决定权。我们致力于让每一个价格、来源与时效都有据可查。</p>
        </div>
        <div className="priceai-boundary-split">
          <article className="do">
            <h3>我们坚持做</h3>
            <ul>{weDo.map((line) => <li key={line}>{line}</li>)}</ul>
          </article>
          <article className="dont">
            <h3>我们坚决不做</h3>
            <ul>{weDont.map((line) => <li key={line}>{line}</li>)}</ul>
          </article>
        </div>
        <div className="priceai-return-card">
          <div><h3>查阅完整的数据采集与排序算法规则</h3><p>公开透明披露：最低价计算口径、陈旧报价清洗机制、异常纠错流程及赞助展示准则。</p></div>
          <Link className="priceai-btn" href="/methodology">查看数据说明与算法细则 <Arrow /></Link>
        </div>
      </div>
    </section>

    <section className="priceai-faq-section" id="faq">
      <div className="priceai-container">
        <div className="priceai-section-heading">
          <p className="priceai-kicker">常见问题</p>
          <h2>关于 PriceAI、渠道和交易安全</h2>
          <p>先了解平台边界和核验方法，再决定去哪里比价与交易。</p>
        </div>
        <div className="priceai-faq-list">{faqs.map(([q, a]) => <article key={q}><h3>{q}</h3><p>{a}</p></article>)}</div>
      </div>
    </section>
  </main><SiteFooter /></div>;
}
