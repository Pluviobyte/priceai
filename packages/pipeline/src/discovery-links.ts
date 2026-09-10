import { sql } from "drizzle-orm";
import type { Database } from "@price-radar/database";
import { PLATFORM_FAMILIES } from "@price-radar/source-signatures";
import { lastSuccessfulDiscoveryAt, recordDiscoveryRun, type CandidateLead } from "./candidates.js";

/**
 * Autonomous discovery from data we already hold: merchants routinely mention
 * their other shops, mirror domains and partner stores inside product
 * descriptions. Every complete crawl therefore yields new shop leads without
 * any third-party directory or search API. Leads are still only addresses —
 * the normal vetting pipeline decides whether a lead is a real, relevant shop.
 */
export const CRAWLED_LINKS_PROVIDER = "crawled_catalog_links";

const URL_PATTERN = /https?:\/\/[^\s"'<>()\[\]{}，。；：！？、）（【】《》]+/gi;
// Bare domains such as "备用地址 aishop.example" written without a scheme.
const BARE_DOMAIN_PATTERN = /(?:^|[\s（(：:，,、/【])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|cn|net|org|xyz|top|shop|vip|cc|io|me|site|store|app|club|link|online|pro|fun|run|live|show|team|cyou|icu|art|win|tech|cloud|dev|one|ai|codes|wang|ltd|group|info|biz|tw|hk|sg|jp|us|uk|de|fr|ru|kr|in|id|th|vn|my|ph))(?![a-z0-9-])/gi;

const UTILITY_HOST_SUFFIXES = [
  "github.com", "githubusercontent.com", "notion.site", "notion.so", "yuque.com", "feishu.cn", "larksuite.com", "flowus.cn",
  "docs.qq.com", "google.com", "googleapis.com", "gstatic.com", "microsoft.com", "live.com", "office.com", "apple.com",
  "icloud.com", "openai.com", "chatgpt.com", "anthropic.com", "claude.ai", "claude.com", "x.ai", "grok.com", "gemini.google",
  "telegram.org", "t.me", "telegram.me", "qq.com", "weixin.qq.com", "wechat.com", "baidu.com", "bilibili.com", "zhihu.com",
  "youtube.com", "youtu.be", "twitter.com", "x.com", "facebook.com", "instagram.com", "reddit.com", "wikipedia.org",
  "tinyurl.com", "bit.ly", "t.cn", "dwz.cn", "u.nu", "is.gd", "cutt.ly", "surl.li", "taobao.com", "tmall.com", "jd.com",
  "pinduoduo.com", "alipay.com", "wikihow.com", "mozilla.org", "gmail.com", "outlook.com", "proton.me", "protonmail.com",
  "example.com", "xxxxxx.com", "localhost", "ping0.cc", "ipinfo.io", "ip.sb", "ip138.com", "whoer.net", "browserleaks.com",
  "cloudflare.com", "vercel.app", "netlify.app", "pages.dev", "workers.dev", "aliyun.com", "alicdn.com", "aliyuncs.com",
  "oss-cn-hangzhou.aliyuncs.com", "qiniu.com", "ldxp.cn",
];

// Subdomain or registrable-domain labels that identify supporting tools rather than shops.
const UTILITY_LABEL_PATTERN = /^(?:2fa|mfa|otp|totp|sms|otpsms|jiema|mail|email|imap|smtp|webmail|gmailcheck|fastmail|fastmailapp|ip|ping|proxy|vpn|dns|convert|conversion|session|token|cookie|check|checker|status|api|cdn|static|img|images|oss|s3|docs|wiki|blog|help|support)$/i;

export function isUtilityHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (UTILITY_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) return true;
  const labels = host.split(".");
  // Only the leading labels describe the service (e.g. sms.example.com); the
  // registrable name is inspected too so 2fa.fun and 2fa.run are excluded.
  const inspect = labels.length > 2 ? [labels[0]!, labels[labels.length - 2]!] : [labels[0]!];
  return inspect.some((label) => UTILITY_LABEL_PATTERN.test(label) || /^(?:2fa|mfa|sms|otp|mail)[a-z0-9-]*$/i.test(label));
}

function familyHost(hostname: string): boolean {
  return PLATFORM_FAMILIES.some((family) => family.hosts.includes(hostname.toLowerCase()));
}

function cleanUrl(raw: string): string | null {
  const trimmed = raw.replace(/[.,;:!?)\]】》」』]+$/g, "");
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** URLs and bare domains mentioned in free text, cleaned and deduplicated. */
export function extractMentionedUrls(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = cleanUrl(match[0]);
    if (url) found.add(url);
  }
  for (const match of text.matchAll(BARE_DOMAIN_PATTERN)) {
    const host = match[1]?.toLowerCase();
    if (!host || [...found].some((url) => new URL(url).hostname === host)) continue;
    found.add(`https://${host}/`);
  }
  return [...found];
}

export interface CrawledCatalogRow {
  sourceId: string;
  sourceHost: string;
  /** The crawled shop's own canonical entry URL, so it never becomes its own lead. */
  sourceEntryUrl?: string;
  productUrl: string;
  rawDescription: string | null;
}

export interface CrawledLinkLead extends CandidateLead {
  mentionedBy: number;
}

/**
 * Turns crawled catalog rows into leads. Links back to the crawled shop itself,
 * supporting-tool hosts and platform home pages without a shop path are dropped;
 * everything else is a possible shop for the vetting pipeline to probe.
 */
export function leadsFromCrawledRows(rows: readonly CrawledCatalogRow[]): CrawledLinkLead[] {
  const byUrl = new Map<string, { lead: CrawledLinkLead; sources: Set<string> }>();
  for (const row of rows) {
    if (!row.rawDescription) continue;
    const selfHost = row.sourceHost.toLowerCase();
    const selfEntry = row.sourceEntryUrl ? cleanUrl(row.sourceEntryUrl) : null;
    for (const url of extractMentionedUrls(row.rawDescription)) {
      const host = new URL(url).hostname;
      if (isUtilityHost(host) || url === selfEntry) continue;
      const pathname = new URL(url).pathname;
      if (familyHost(host)) {
        // On a multi-tenant platform only a shop path identifies another merchant; item links
        // on the merchant's own platform almost always point back to its own goods.
        if (!/\/shop\/[^/]+/.test(pathname) && !(host !== selfHost && /\/item\/[^/]+/.test(pathname))) continue;
      } else if (host === selfHost) {
        continue;
      }
      const existing = byUrl.get(url);
      if (existing) {
        existing.sources.add(row.sourceId);
        existing.lead.mentionedBy = existing.sources.size;
        continue;
      }
      byUrl.set(url, {
        sources: new Set([row.sourceId]),
        lead: { url, provider: CRAWLED_LINKS_PROVIDER, discoveryKind: "crawl", discoveryUrl: row.productUrl, mentionedBy: 1 },
      });
    }
  }
  return [...byUrl.values()].map((entry) => entry.lead).sort((left, right) => right.mentionedBy - left.mentionedBy);
}

export interface CrawledLinksDiscoveryOptions {
  signal?: AbortSignal;
  minIntervalMs?: number;
  now?: Date;
  /** Upper bound on catalog rows read per run. */
  maxRows?: number;
}

/** Reads the latest complete catalog of every enabled source and ingests the shops they link to. */
export async function mineCrawledCatalogLinks(db: Database, options: CrawledLinksDiscoveryOptions = {}) {
  const now = options.now ?? new Date();
  if (options.minIntervalMs) {
    const last = await lastSuccessfulDiscoveryAt(db, CRAWLED_LINKS_PROVIDER);
    if (last && now.getTime() - last.getTime() < options.minIntervalMs) return { status: "skipped" as const };
  }
  const maxRows = Math.max(1_000, Math.min(options.maxRows ?? 200_000, 1_000_000));
  const run = await recordDiscoveryRun(db, { kind: "crawl", query: "raw_offer_snapshots.description_links", provider: CRAWLED_LINKS_PROVIDER }, async () => {
    options.signal?.throwIfAborted();
    const { rows } = await db.execute<{ source_id: string; source_host: string; source_entry_url: string; product_url: string; raw_description: string | null }>(sql`
      with latest as (
        select distinct on (s.id) s.id as source_id, r.id as run_id, s.canonical_entry_url as source_entry_url,
          lower(split_part(split_part(s.canonical_entry_url, '://', 2), '/', 1)) as source_host
        from sources s join crawl_runs r on r.source_id = s.id
        where s.enabled and r.status = 'success' and r.complete_snapshot
        order by s.id, r.started_at desc
      )
      select l.source_id, l.source_host, l.source_entry_url, o.product_url, o.raw_description
      from raw_offer_snapshots o join latest l on l.run_id = o.crawl_run_id
      where o.raw_description ~* '(https?://|\\.(?:com|cn|net|xyz|top|shop|vip|cc|io|me|site|store|app|club|link|online|pro|fun|run|live|show|team|cyou|icu|art|win|tech|cloud|dev|one|ai|codes)\\b)'
      limit ${maxRows}`);
    const leads = leadsFromCrawledRows(rows.map((row) => ({ sourceId: row.source_id, sourceHost: row.source_host, sourceEntryUrl: row.source_entry_url, productUrl: row.product_url, rawDescription: row.raw_description })));
    return leads.map(({ mentionedBy: _mentionedBy, ...lead }) => lead);
  });
  return { status: "success" as const, ...run };
}
