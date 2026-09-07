import type { Metadata } from "next";
import Link from "next/link";
import { OFFICIAL_SUBSCRIPTION_PLAN_CATALOG } from "@price-radar/price-channels/subscription-catalog";
import { getOfficialSubscriptionChecks, getOfficialSubscriptionPrices, isFreshOfficialSubscriptionPrice, type OfficialSubscriptionPrice } from "@/lib/public-pricing";
import { ModelIcon, type ModelIconName } from "../model-icons";
import { SiteFooter } from "../site-footer";
import { PriceComparison } from "./price-comparison";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI 官方订阅价格对比 | PriceAI",
  description: "对比 ChatGPT、Claude 与 Grok 等 AI 官方订阅在官网、iOS Store 和 Google Play 的公开价格与购买条件。",
};

const vendorNames: Record<string, string> = { anthropic: "Claude", openai: "ChatGPT", google: "Gemini", xai: "Grok" };
const companyNames: Record<string, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google", xai: "xAI" };
const vendorIcons: Record<string, ModelIconName> = { anthropic: "claude", openai: "openai", google: "gemini", xai: "grok" };
const channelNames: Record<string, string> = { web: "官网直购", app_store: "iOS Store", google_play: "Google Play" };
const periodNames: Record<string, string> = { month: "月付", year: "年付", one_time: "一次性" };
const countryNames: Record<string, string> = {
  AR: "阿根廷", AU: "澳大利亚", BO: "玻利维亚", BR: "巴西", CA: "加拿大", CL: "智利", CN: "中国大陆",
  CO: "哥伦比亚", EG: "埃及", GB: "英国", HK: "中国香港", ID: "印度尼西亚", IN: "印度", JP: "日本",
  KR: "韩国", MX: "墨西哥", MY: "马来西亚", NG: "尼日利亚", NZ: "新西兰", PH: "菲律宾", PK: "巴基斯坦",
  SG: "新加坡", TH: "泰国", TR: "土耳其", TW: "中国台湾", US: "美国", VN: "越南", ZA: "南非",
};

type PlanGroup = {
  key: string;
  vendor: string;
  planCode: string;
  planName: string;
  billingPeriod: string;
  officialUrl: string;
  rows: OfficialSubscriptionPrice[];
  lowest: OfficialSubscriptionPrice | null;
  latest: Date | null;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function relative(value: Date | null): string {
  if (!value) return "等待核验";
  const minutes = Math.max(1, Math.round((Date.now() - value.getTime()) / 60000));
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}小时前` : `${Math.round(hours / 24)}天前`;
}

function normalizedPlanCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function planHref(plan: PlanGroup): string {
  const vendor = vendorNames[plan.vendor.toLowerCase()]?.toLowerCase() ?? plan.vendor.toLowerCase();
  return `/official-prices/${encodeURIComponent(`${vendor}__${normalizedPlanCode(plan.planCode)}`)}`;
}

function groupPlans(rows: OfficialSubscriptionPrice[]): PlanGroup[] {
  const groups = new Map<string, {
    vendor: string;
    planCode: string;
    planName: string;
    billingPeriod: string;
    officialUrl: string;
    rows: OfficialSubscriptionPrice[];
  }>();

  for (const plan of OFFICIAL_SUBSCRIPTION_PLAN_CATALOG) {
    const key = `${plan.vendor}::${plan.planCode}::${plan.billingPeriod}`;
    groups.set(key, { ...plan, planName: plan.displayName, rows: [] });
  }

  for (const row of rows) {
    const key = `${row.vendor}::${row.planCode}::${row.billingPeriod}`;
    const current = groups.get(key);
    groups.set(key, current
      ? { ...current, planName: row.planName, rows: [...current.rows, row] }
      : {
          vendor: row.vendor,
          planCode: row.planCode,
          planName: row.planName,
          billingPeriod: row.billingPeriod,
          officialUrl: row.evidenceUrl,
          rows: [row],
        });
  }

  return [...groups.entries()].map(([key, group]) => {
    const comparable = group.rows
      .filter((row) => row.priceKind === "exact" && row.cnyEstimate !== null && isFreshOfficialSubscriptionPrice(row))
      .sort((a, b) => Number(a.cnyEstimate) - Number(b.cnyEstimate));
    const latest = group.rows.reduce<Date | null>((current, row) => !current || row.verifiedAt > current ? row.verifiedAt : current, null);
    return { key, ...group, lowest: comparable[0] ?? null, latest };
  }).sort((a, b) => {
    const vendorOrder = ["openai", "anthropic", "google", "xai"];
    return vendorOrder.indexOf(a.vendor) - vendorOrder.indexOf(b.vendor)
      || a.planName.localeCompare(b.planName, "zh-CN");
  });
}

function ProductIcon({ vendor, label }: { vendor: string; label: string }) {
  const icon = vendorIcons[vendor.toLowerCase()];
  return <span className="priceai-official-product-icon" aria-hidden="true">
    {icon ? <ModelIcon name={icon} label={label} /> : label.slice(0, 1).toUpperCase()}
  </span>;
}

export default async function OfficialPricesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q = first(raw.q).trim();
  const vendor = first(raw.vendor).trim().toLowerCase();
  const channel = first(raw.channel).trim().toLowerCase();
  const period = first(raw.period).trim().toLowerCase();

  let databaseAvailable = true;
  let allRows: OfficialSubscriptionPrice[] = [];
  try {
    allRows = await getOfficialSubscriptionPrices();
  } catch {
    databaseAvailable = false;
  }

  const checks = await getOfficialSubscriptionChecks().catch(() => null);
  const scopedRows = allRows.filter((row) => !channel || row.channel === channel);
  const allPlans = groupPlans(scopedRows);
  const query = q.toLocaleLowerCase("zh-CN");
  const plans = allPlans.filter((plan) => {
    const vendorMatch = !vendor || plan.vendor.toLowerCase() === vendor;
    const channelMatch = !channel || plan.rows.length > 0;
    const periodMatch = !period || plan.billingPeriod === period;
    const haystack = `${plan.planName} ${plan.planCode} ${vendorNames[plan.vendor.toLowerCase()] ?? plan.vendor} ${plan.rows.map((row) => `${row.countryCode} ${row.currency} ${row.channel}`).join(" ")}`.toLocaleLowerCase("zh-CN");
    return vendorMatch && channelMatch && periodMatch && (!query || haystack.includes(query));
  });
  const latest = allRows.reduce<Date | null>((current, row) => !current || row.verifiedAt > current ? row.verifiedAt : current, null);
  const channelCount = new Set(allRows.map((row) => row.channel)).size;
  const categories = [["全部", ""], ["ChatGPT", "openai"], ["Claude", "anthropic"], ["Gemini", "google"], ["Grok", "xai"]] as const;
  const filterHref = (nextVendor: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (channel) params.set("channel", channel);
    if (period) params.set("period", period);
    if (nextVendor) params.set("vendor", nextVendor);
    return params.size ? `/official-prices?${params}` : "/official-prices";
  };

  return <div className="priceai-page priceai-catalog-page priceai-official-page">

    <nav className="priceai-category-rail" aria-label="按产品筛选">
      {categories.map(([label, value]) => <Link className={vendor === value ? "active" : undefined} href={filterHref(value)} key={label}>{label}</Link>)}
    </nav>

    <main className="priceai-catalog-shell">
      <section className="priceai-catalog-hero priceai-official-hero">
        <div>
          <p className="priceai-kicker">官方订阅</p>
          <h1>先看官方价，再决定在哪里买</h1>
          <p className="priceai-catalog-intro">把官网、iOS Store 与 Google Play 的公开标价放到同一张表里。先确认套餐、地区和支付门槛，再比较第三方渠道，避免只盯最低价买错交付方式。</p>
          <p className="priceai-catalog-meta">最近核验：{relative(latest)}　·　展示 {allPlans.length} 个官方套餐目录　·　人民币金额仅作换算参考</p>
        </div>
        <dl aria-label="官方订阅数据概览">
          <div><dt>套餐目录</dt><dd>{allPlans.length}</dd></div>
          <div><dt>核验报价</dt><dd>{allRows.length || "待接入"}</dd></div>
          <div><dt>覆盖渠道</dt><dd>{channelCount || "待接入"}</dd></div>
        </dl>
      </section>

      <section className="priceai-official-checklist" aria-labelledby="official-checklist-title">
        <header><p className="priceai-kicker">购买前先确认</p><h2 id="official-checklist-title">同一个订阅，结算方式会改变实际成本</h2></header>
        <ol>
          <li><span>01</span><div><b>先选套餐</b><small>个人、Pro 与高额度套餐的能力和限制不同。</small></div></li>
          <li><span>02</span><div><b>再看地区</b><small>地区资格、币种、税费和可用支付方式需要一起核对。</small></div></li>
          <li><span>03</span><div><b>最后选渠道</b><small>官网、苹果与 Google 的标价和退款路径可能不同。</small></div></li>
        </ol>
        <Link href="/guides/how-to-subscribe-ai-officially">阅读官方订阅指南　›</Link>
      </section>

      <div className={`priceai-official-source-state${databaseAvailable && allRows.length ? " live" : " pending"}`} role="status">
        <span aria-hidden="true" />
        <p><b>{databaseAvailable && allRows.length ? "已连接核验数据" : "价格数据正在接入"}</b>{databaseAvailable && allRows.length ? "表内金额来自带来源链接和核验时间的数据库记录。" : "先展示已有的官方套餐目录；具体金额请以厂商结算页为准。"}</p>
      </div>

      <div className="priceai-catalog-toolbar priceai-official-toolbar">
        <form action="/official-prices">
          <label className="sr-only" htmlFor="official-query">搜索官方订阅</label>
          <input id="official-query" name="q" defaultValue={q} placeholder="搜索 ChatGPT、Claude、Gemini 或 Grok" />
          {vendor && <input type="hidden" name="vendor" value={vendor} />}
          <fieldset className="official-filter-group"><legend className="sr-only">筛选官方套餐</legend>
          <div className="official-filter-field"><label htmlFor="official-channel">购买渠道</label>
          <select id="official-channel" name="channel" defaultValue={channel}><option value="">全部渠道</option><option value="web">官网直购</option><option value="app_store">iOS Store</option><option value="google_play">Google Play</option></select>
          </div><div className="official-filter-field"><label htmlFor="official-period">结算周期</label>
          <select id="official-period" name="period" defaultValue={period}><option value="">全部周期</option><option value="month">月付</option><option value="year">年付</option></select>
          </div><button type="submit" className="official-filter-submit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" /></svg>筛选</button></fieldset>
        </form>
        <nav aria-label="官方价格相关页面"><Link className="active" href="/official-prices">套餐总览</Link><a href="#price-comparison">订阅价格对照表</a><Link href="/official-prices/regions">地区对照</Link><Link href="/official-api">官方 API</Link></nav>
      </div>
      <div className="priceai-catalog-status"><span>{plans.length} 个匹配套餐</span>{(q || vendor || channel || period) && <Link href="/official-prices">清空全部条件</Link>}</div>

      {plans.length ? <div className="priceai-data-table-wrap priceai-official-table-wrap">
        <table className="priceai-data-table priceai-official-table">
          <thead><tr><th>标准商品</th><th>周期</th><th>已采集最低价</th><th>对应地区</th><th>报价样本</th><th>最近核验</th></tr></thead>
          <tbody>{plans.map((plan) => {
            const lowest = plan.lowest;
            const amount = lowest?.cnyEstimate ? `¥${Number(lowest.cnyEstimate).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "等待核验";
            const original = lowest?.amount ? `${lowest.currency} ${Number(lowest.amount).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}` : "以官方结算页为准";
            return <tr key={plan.key}>
              <td><Link className="priceai-official-product" href={planHref(plan)}><ProductIcon vendor={plan.vendor} label={plan.planName} /><span><b>{plan.planName}</b><small>{companyNames[plan.vendor.toLowerCase()] ?? plan.vendor}</small></span></Link></td>
              <td><b>{periodNames[plan.billingPeriod] ?? plan.billingPeriod}</b><small>{vendorNames[plan.vendor.toLowerCase()] ?? plan.vendor}</small></td>
              <td><Link href={planHref(plan)}><strong>{amount}</strong><em className={lowest ? undefined : "pending"}>{lowest ? channelNames[lowest.channel] ?? lowest.channel : "尚无核验价"}</em></Link></td>
              <td><b>{lowest ? countryNames[lowest.countryCode] ?? lowest.countryCode : "—"}</b><small>{original}</small></td>
              <td><b>{plan.rows.length || "—"}</b><small>{plan.rows.length ? "公开地区报价" : "等待价格入库"}</small></td>
              <td><span>{relative(plan.latest)}</span><Link className="priceai-row-button" href={planHref(plan)}>查看　›</Link></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <div className="empty-state">没有匹配的官方订阅套餐，请尝试其他关键词或产品。</div>}

      <PriceComparison rows={allRows} checks={checks} params={raw} available={databaseAvailable} />

      <aside className="priceai-official-note"><b>读表提醒</b><p>人民币估算不额外计入当地税费、银行卡跨境手续费或应用商店结算差异。能否购买还取决于账号地区和支付方式，付款前请回到官方页面再次确认。</p></aside>
      <p className="priceai-catalog-disclaimer">PriceAI 只整理可核验的官方公开信息，不销售订阅、不代购，也不保证地区购买资格或支付可用性。</p>
    </main>
    <SiteFooter />
  </div>;
}
