import type { Metadata } from "next";
import Link from "next/link";
import { API_SECTIONS_ENABLED } from "@/lib/site-features";
import {
  OFFICIAL_SUBSCRIPTION_PLAN_CATALOG,
  OFFICIAL_SUBSCRIPTION_REGION_CATALOG,
} from "@price-radar/price-channels/subscription-catalog";
import { findAppleStorefront, regionDisplayName } from "@price-radar/price-channels/storefront-catalog";
import { getOfficialSubscriptionChecks, getOfficialSubscriptionPrices, getOfficialSubscriptionPriceStatus, hasVerifiedSubscriptionBilling, isFreshOfficialSubscriptionPrice, type OfficialSubscriptionCheck, type OfficialSubscriptionPrice } from "@/lib/public-pricing";
import { ModelIcon, type ModelIconName } from "../../model-icons";
import { SiteFooter } from "../../site-footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI 官方订阅地区价格对照表 | PriceAI",
  description: "横向比较 ChatGPT、Claude、Gemini 与 Grok 官方订阅在不同国家和应用商店的原币价格、人民币估算与核验时间。",
};

const channelNames: Record<string, string> = {
  web: "官网",
  app_store: "iOS Store",
  google_play: "Google Play",
};
const vendorNames: Record<string, string> = { openai: "ChatGPT", anthropic: "Claude", google: "Gemini", xai: "Grok" };
const vendorIcons: Record<string, ModelIconName> = { openai: "openai", anthropic: "claude", google: "gemini", xai: "grok" };
const periodNames: Record<string, string> = { month: "月付", year: "年付", one_time: "一次性" };
const channels = ["web", "app_store", "google_play"] as const;

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatRelativeVerificationTime(value: Date | null): string {
  if (!value) return "尚未核验";
  const minutes = Math.max(1, Math.round((Date.now() - value.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} 小时前` : `${Math.round(hours / 24)} 天前`;
}

function priceDate(value: Date): string {
  return new Date(value).toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function formatNumber(value: string, currency: string): string {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: ["IDR", "JPY"].includes(currency) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function originalPrice(row: OfficialSubscriptionPrice): string {
  if (row.priceKind === "exact" && row.amount) return `${row.currency} ${formatNumber(row.amount, row.currency)}`;
  if (row.priceKind === "range" && row.lowerAmount && row.upperAmount) {
    return `${row.currency} ${formatNumber(row.lowerAmount, row.currency)}–${formatNumber(row.upperAmount, row.currency)}`;
  }
  return "未公开精确价";
}

function cnyPrice(row: OfficialSubscriptionPrice | null): string {
  return row?.cnyEstimate
    ? `≈ ¥${Number(row.cnyEstimate).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
}

function newestPriceRecord(rows: readonly OfficialSubscriptionPrice[]): OfficialSubscriptionPrice | null {
  return rows.reduce<OfficialSubscriptionPrice | null>((latest, row) =>
    !latest || row.verifiedAt > latest.verifiedAt ? row : latest, null);
}

function PriceCell({ row, check }: { row: OfficialSubscriptionPrice | null; check: OfficialSubscriptionCheck | undefined }) {
  if (!row || check?.status === "price_anomaly") return <div className="priceai-region-price"><span className="priceai-region-missing">{check?.status === "price_anomaly" ? "源站金额异常 · 待核验" : "尚未取得套餐报价"}</span>{check && <details><summary>查看原因与来源</summary><small>{check.reason}</small><small>检查日期 {priceDate(check.checkedAt)}</small><a href={check.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">查看官方来源 ↗</a></details>}</div>;
  const fresh = isFreshOfficialSubscriptionPrice(row);
  return <div className={`priceai-region-price${fresh ? "" : " is-stale"}`}>
    <a className="priceai-region-price-source" href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow"><b>{originalPrice(row)}</b></a>
    <small>{row.cnyEstimate ? cnyPrice(row) : "人民币换算待补"} · {hasVerifiedSubscriptionBilling(row) ? periodNames[row.billingPeriod] ?? row.billingPeriod : "周期待核验"}</small>
    <em className={fresh ? undefined : "stale"}>{getOfficialSubscriptionPriceStatus(row)}</em>
    <small>{row.evidenceUrl.includes("/introducing-chatgpt-go/") ? "公告日期" : "价格日期"} {priceDate(row.verifiedAt)}</small>
    <small>{row.exchangeRateDate ? row.exchangeRateUrl ? <a href={row.exchangeRateUrl} target="_blank" rel="noopener noreferrer nofollow">汇率日期 {row.exchangeRateDate} ↗</a> : `汇率日期 ${row.exchangeRateDate}` : "汇率日期待补"}</small>
  </div>;
}

export default async function OfficialPriceRegionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const requestedPlanCode = firstQueryValue(raw.plan);
  const selectedPlan = OFFICIAL_SUBSCRIPTION_PLAN_CATALOG.find((plan) => plan.planCode === requestedPlanCode)
    ?? OFFICIAL_SUBSCRIPTION_PLAN_CATALOG.find((plan) => plan.planCode === "chatgpt-plus-monthly")
    ?? OFFICIAL_SUBSCRIPTION_PLAN_CATALOG[0]!;

  let databaseAvailable = true;
  let allRows: OfficialSubscriptionPrice[] = [];
  try {
    allRows = await getOfficialSubscriptionPrices();
  } catch {
    databaseAvailable = false;
  }
  const checks = await getOfficialSubscriptionChecks().catch(() => []);
  const planRows = allRows.filter((row) => row.vendor === selectedPlan.vendor && row.planCode === selectedPlan.planCode);
  const latest = newestPriceRecord(planRows)?.verifiedAt ?? null;
  const vendorOrder = ["openai", "anthropic", "google", "xai"];
  const groupedPlans = vendorOrder.map((vendor) => ({
    vendor,
    plans: OFFICIAL_SUBSCRIPTION_PLAN_CATALOG.filter((plan) => plan.vendor === vendor),
  })).filter((group) => group.plans.length);

  // Featured regions first, then every other region that has a record or a source check for this plan.
  const planChecks = checks.filter((check) => check.vendor === selectedPlan.vendor && check.planCode === selectedPlan.planCode);
  const otherCodes = [...new Set([...planRows.map((row) => row.countryCode), ...planChecks.map((check) => check.countryCode)])]
    .filter((code) => !OFFICIAL_SUBSCRIPTION_REGION_CATALOG.some((region) => region.countryCode === code))
    .map((code) => ({ countryCode: code, displayName: regionDisplayName(code), currency: findAppleStorefront(code)?.currency ?? planRows.find((row) => row.countryCode === code)?.currency ?? "—" }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "zh-CN"));
  const regionCatalog = [...OFFICIAL_SUBSCRIPTION_REGION_CATALOG.map((region) => ({ countryCode: region.countryCode, displayName: region.displayName, currency: region.currency })), ...otherCodes];
  const regionRows = regionCatalog.map((region) => {
    const byChannel = Object.fromEntries(channels.map((channel) => {
      const matching = planRows.filter((row) => row.countryCode === region.countryCode && row.channel === channel);
      return [channel, newestPriceRecord(matching)];
    })) as Record<(typeof channels)[number], OfficialSubscriptionPrice | null>;
    const regionPrices = channels.map((channel) => byChannel[channel]).filter((row): row is OfficialSubscriptionPrice => Boolean(row));
    return { region, byChannel, latest: newestPriceRecord(regionPrices)?.verifiedAt ?? null };
  });
  const icon = vendorIcons[selectedPlan.vendor];

  return <div className="priceai-page priceai-catalog-page priceai-official-page priceai-regions-page">

    <nav className="priceai-category-rail" aria-label="官方价格页面">
      <Link href="/official-prices">套餐总览</Link>
      <Link className="active" href="/official-prices/regions">地区对照</Link>
      {API_SECTIONS_ENABLED && <Link href="/official-api">官方 API</Link>}
      <Link href="/guides/how-to-subscribe-ai-officially">购买指南</Link>
    </nav>

    <main className="priceai-catalog-shell">
      <section className="priceai-region-hero">
        <div className="priceai-region-identity">
          <span className="priceai-official-product-icon" aria-hidden="true">{icon ? <ModelIcon name={icon} label={selectedPlan.displayName} /> : selectedPlan.displayName.slice(0, 1)}</span>
          <div><p className="priceai-kicker">官方订阅 · 地区对照 · 目录周期：{periodNames[selectedPlan.billingPeriod] ?? selectedPlan.billingPeriod}</p><h1>{selectedPlan.displayName} 地区价格参考</h1></div>
        </div>
        <p>按地区查看官网、iOS Store 与 Google Play 的公开标价及证据状态。周期未核验的内购金额不能直接当作月费；人民币仅为汇率估算，各渠道税费和购买资格可能不同。</p>
        <div className="priceai-region-refresh-state" role="status"><span aria-hidden="true" /><b>{databaseAvailable && latest ? `最新价格日期 ${priceDate(latest)}` : "等待首轮价格入库"}</b><small>系统每日检查 Apple 各商店、Google 与 OpenAI 各国官网页面；保留的历史记录会标明日期与证据状态。</small></div>
      </section>

      <div className="priceai-catalog-toolbar priceai-region-toolbar">
        <form action="/official-prices/regions">
          <label htmlFor="region-plan">选择要对照的订阅套餐</label>
          <select id="region-plan" name="plan" defaultValue={selectedPlan.planCode}>
            {groupedPlans.map((group) => <optgroup label={vendorNames[group.vendor] ?? group.vendor} key={group.vendor}>
              {group.plans.map((plan) => <option value={plan.planCode} key={plan.planCode}>{plan.displayName}</option>)}
            </optgroup>)}
          </select>
          <button type="submit">查看地区价格</button>
        </form>
        <a className="priceai-region-official-link" href={selectedPlan.officialUrl} target="_blank" rel="noopener noreferrer nofollow">打开厂商页面　↗</a>
      </div>

      <div className="priceai-catalog-status"><span>{OFFICIAL_SUBSCRIPTION_REGION_CATALOG.length} 个重点地区 + {otherCodes.length} 个其他地区 · {planRows.length} 条公开价格记录</span><span>请先核对渠道、周期与证据状态</span></div>

      <div className="priceai-region-table-wrap">
        <table className="priceai-region-table">
          <thead><tr><th>地区</th><th>官网</th><th>iOS Store</th><th>Google Play</th><th>最新价格日期</th></tr></thead>
          <tbody>{regionRows.map(({ region, byChannel, latest: regionLatest }) => <tr key={region.countryCode}>
            <td data-label="地区"><b>{region.displayName}</b><small>{region.countryCode}</small></td>
            {channels.map((channel) => {
              const row = byChannel[channel];
              return <td data-label={channelNames[channel]} key={channel}><PriceCell row={row} check={checks.find(check => check.planCode === selectedPlan.planCode && check.vendor === selectedPlan.vendor && check.channel === channel && check.countryCode === region.countryCode)} /></td>;
            })}
            <td data-label="最新价格日期"><time dateTime={regionLatest?.toISOString()}>{regionLatest ? priceDate(regionLatest) : "尚无记录"}</time><small>{regionLatest ? formatRelativeVerificationTime(regionLatest) : ""}</small></td>
          </tr>)}</tbody>
        </table>
      </div>

      <aside className="priceai-official-note"><b>怎样读这张表</b><p>“周期待核验”表示只取得公开内购金额，尚不能确定月付、年付或优惠资格；“同名歧义”与“已过期”的记录仅供追溯。没有报价不代表不能购买。应用商店标价与官网税费口径可能不同，人民币估算未计入额外税费、银行卡跨境费或汇率差。</p></aside>
      <p className="priceai-catalog-disclaimer">PriceAI 只展示可回到原页面核验的公开记录；不销售订阅，也不建议为了低价伪造地区资格。</p>
    </main>
    <SiteFooter />
  </div>;
}
