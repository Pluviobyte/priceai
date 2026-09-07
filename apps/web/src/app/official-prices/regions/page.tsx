import type { Metadata } from "next";
import Link from "next/link";
import {
  OFFICIAL_SUBSCRIPTION_PLAN_CATALOG,
  OFFICIAL_SUBSCRIPTION_REGION_CATALOG,
} from "@price-radar/price-channels/subscription-catalog";
import { getOfficialSubscriptionPrices, isFreshOfficialSubscriptionPrice, type OfficialSubscriptionPrice } from "@/lib/public-pricing";
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
    ? `¥${Number(row.cnyEstimate).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
}

function newestPriceRecord(rows: readonly OfficialSubscriptionPrice[]): OfficialSubscriptionPrice | null {
  return rows.reduce<OfficialSubscriptionPrice | null>((latest, row) =>
    !latest || row.verifiedAt > latest.verifiedAt ? row : latest, null);
}

function PriceCell({ row, isLowest }: { row: OfficialSubscriptionPrice | null; isLowest: boolean }) {
  if (!row || row.priceKind === "unknown") return <span className="priceai-region-missing">待核验</span>;
  const fresh = isFreshOfficialSubscriptionPrice(row);
  return <div className={`priceai-region-price${isLowest ? " is-lowest" : ""}${fresh ? "" : " is-stale"}`}>
    <a className="priceai-region-price-source" href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow"><b>{originalPrice(row)}</b></a>
    <small>{row.cnyEstimate ? `约 ${cnyPrice(row)}` : "人民币换算待补"}{row.exchangeRateDate && row.exchangeRateUrl && <> · <a href={row.exchangeRateUrl} target="_blank" rel="noopener noreferrer nofollow">汇率 {row.exchangeRateDate} ↗</a></>}</small>
    <small>价格核验 {formatRelativeVerificationTime(row.verifiedAt)}</small>
    {isLowest ? <em>全表较低</em> : !fresh ? <em className="stale">已过期</em> : null}
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
  const planRows = allRows.filter((row) => row.vendor === selectedPlan.vendor && row.planCode === selectedPlan.planCode);
  const exactRows = planRows.filter((row) => row.priceKind === "exact" && row.cnyEstimate !== null && isFreshOfficialSubscriptionPrice(row));
  const lowestValue = exactRows.length ? Math.min(...exactRows.map((row) => Number(row.cnyEstimate))) : null;
  const latest = newestPriceRecord(planRows)?.verifiedAt ?? null;
  const vendorOrder = ["openai", "anthropic", "google", "xai"];
  const groupedPlans = vendorOrder.map((vendor) => ({
    vendor,
    plans: OFFICIAL_SUBSCRIPTION_PLAN_CATALOG.filter((plan) => plan.vendor === vendor),
  })).filter((group) => group.plans.length);

  const regionRows = OFFICIAL_SUBSCRIPTION_REGION_CATALOG.map((region) => {
    const byChannel = Object.fromEntries(channels.map((channel) => {
      const matching = planRows.filter((row) => row.countryCode === region.countryCode && row.channel === channel);
      return [channel, newestPriceRecord(matching)];
    })) as Record<(typeof channels)[number], OfficialSubscriptionPrice | null>;
    const regionPrices = channels.map((channel) => byChannel[channel]).filter((row): row is OfficialSubscriptionPrice => Boolean(row));
    const regionExact = regionPrices.filter((row) => row.priceKind === "exact" && row.cnyEstimate !== null && isFreshOfficialSubscriptionPrice(row))
      .sort((left, right) => Number(left.cnyEstimate) - Number(right.cnyEstimate));
    return { region, byChannel, lowest: regionExact[0] ?? null, latest: newestPriceRecord(regionPrices)?.verifiedAt ?? null };
  });
  const icon = vendorIcons[selectedPlan.vendor];

  return <div className="priceai-page priceai-catalog-page priceai-official-page priceai-regions-page">

    <nav className="priceai-category-rail" aria-label="官方价格页面">
      <Link href="/official-prices">套餐总览</Link>
      <Link className="active" href="/official-prices/regions">地区对照</Link>
      <Link href="/official-api">官方 API</Link>
      <Link href="/guides/how-to-subscribe-ai-officially">购买指南</Link>
    </nav>

    <main className="priceai-catalog-shell">
      <section className="priceai-region-hero">
        <div className="priceai-region-identity">
          <span className="priceai-official-product-icon" aria-hidden="true">{icon ? <ModelIcon name={icon} label={selectedPlan.displayName} /> : selectedPlan.displayName.slice(0, 1)}</span>
          <div><p className="priceai-kicker">官方订阅 · 地区对照 · {periodNames[selectedPlan.billingPeriod] ?? selectedPlan.billingPeriod}</p><h1>{selectedPlan.displayName} 在不同地区卖多少钱</h1></div>
        </div>
        <p>同一套餐按地区横向比较官网、iOS Store 与 Google Play 公开标价。原币价格来自官方页面，人民币只按最近可用汇率估算。</p>
        <div className="priceai-region-refresh-state" role="status"><span aria-hidden="true" /><b>{databaseAvailable && planRows.length ? `最近核验 ${formatRelativeVerificationTime(latest)}` : "等待首轮价格入库"}</b><small>系统每小时尝试更新；来源失败时保留上一条核验记录，不用空值覆盖。</small></div>
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

      <div className="priceai-catalog-status"><span>{OFFICIAL_SUBSCRIPTION_REGION_CATALOG.length} 个重点地区 · {planRows.length} 条核验记录</span><span>税费与支付资格以结算页为准</span></div>

      <div className="priceai-region-table-wrap">
        <table className="priceai-region-table">
          <thead><tr><th>地区</th><th>官网</th><th>iOS Store</th><th>Google Play</th><th>当地最低</th><th>该地区最近</th></tr></thead>
          <tbody>{regionRows.map(({ region, byChannel, lowest, latest: regionLatest }) => <tr key={region.countryCode}>
            <td data-label="地区"><b>{region.displayName}</b><small>{region.countryCode} · {region.currency}</small></td>
            {channels.map((channel) => {
              const row = byChannel[channel];
              const isLowest = Boolean(row?.cnyEstimate && lowest?.id === row.id && lowestValue !== null && Number(row.cnyEstimate) === lowestValue);
              return <td data-label={channelNames[channel]} key={channel}><PriceCell row={row} isLowest={isLowest} /></td>;
            })}
            <td data-label="当地最低"><strong>{cnyPrice(lowest)}</strong><small>{lowest ? channelNames[lowest.channel] ?? lowest.channel : "暂无可比精确价"}</small></td>
            <td data-label="该地区最近"><time dateTime={regionLatest?.toISOString()}>{formatRelativeVerificationTime(regionLatest)}</time></td>
          </tr>)}</tbody>
        </table>
      </div>

      <aside className="priceai-official-note"><b>怎样读这张表</b><p>“待核验”表示官方公开页面没有暴露可稳定读取的精确价格，不代表该地区不能购买。应用商店标价可能含税，官网结算还可能叠加当地税、银行卡跨境费或汇率差。</p></aside>
      <p className="priceai-catalog-disclaimer">PriceAI 只展示可回到原页面核验的公开记录；不销售订阅，也不建议为了低价伪造地区资格。</p>
    </main>
    <SiteFooter />
  </div>;
}
