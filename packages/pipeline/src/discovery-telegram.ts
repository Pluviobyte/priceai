import { boundedDiscoveryRead, runScheduledDiscovery } from "./discovery-schedule.js";
import { DiscoveryHttpError } from "./discovery-policy.js";
import { sql } from "drizzle-orm";
import { hostThrottle } from "@price-radar/collector-sdk";
import type { Database } from "@price-radar/database";
import type { CandidateLead } from "./candidates.js";
import { isUtilityHost, mentionLooksLikeShop } from "./discovery-links.js";

/**
 * Public Telegram channels render at https://t.me/s/<handle> without an
 * account or API key. Merchants advertise shop addresses, mirror domains and
 * partner channels there. Seeds come from the channels our own crawled
 * catalogs mention; every discovered channel can in turn reveal further ones.
 */
export const TELEGRAM_CHANNEL_PROVIDER = "telegram_public_channels";

const USER_AGENT = "AIPriceRadar/0.1 (+public-channel-discovery; shop URLs only)";
const HANDLE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;

/** Public channel handles referenced as t.me links; invite links (+hash, joinchat) are private and ignored. */
export function extractTelegramHandles(text: string): string[] {
  const handles = new Set<string>();
  for (const match of text.matchAll(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_+]+)/gi)) {
    const handle = match[1] ?? "";
    if (handle.startsWith("+") || /^(?:joinchat|addstickers|proxy|share|iv|c|s)$/i.test(handle) || !HANDLE.test(handle)) continue;
    handles.add(handle.toLowerCase());
  }
  return [...handles];
}

export interface TelegramMessage {
  post: string;
  text: string;
  links: string[];
}

export interface TelegramChannelPage {
  title: string | null;
  messages: TelegramMessage[];
  /** Cursor for the next older page (t.me/s/<handle>?before=<id>). */
  before: number | null;
}

function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}

export function parseTelegramChannelPage(html: string): TelegramChannelPage {
  const title = html.match(/<div class="tgme_channel_info_header_title"[^>]*>\s*<span[^>]*>(.*?)<\/span>/s)?.[1];
  const messages: TelegramMessage[] = [];
  const blocks = html.split(/(?=<div class="tgme_widget_message_wrap)/);
  for (const block of blocks) {
    const post = block.match(/data-post="([^"]+)"/)?.[1];
    const body = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    if (!post || body === undefined) continue;
    const links = [...new Set([...body.matchAll(/href="([^"]+)"/g)].map((match) => decodeEntities(match[1] ?? "")))];
    const text = decodeEntities(body.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").trim();
    messages.push({ post, text, links });
  }
  const before = html.match(/class="tme_messages_more[^"]*"[^>]*data-before="(\d+)"/)?.[1];
  return { title: title ? decodeEntities(title.replace(/<[^>]+>/g, "")).trim() : null, messages, before: before ? Number(before) : null };
}

async function fetchChannelPage(handle: string, before: number | null, signal: AbortSignal): Promise<string | null> {
  const url = new URL(`https://t.me/s/${encodeURIComponent(handle)}`);
  if (before) url.searchParams.set("before", String(before));
  return hostThrottle.run(url.hostname, async () => {
    const response = await fetch(url, { redirect: "follow", headers: { accept: "text/html", "user-agent": USER_AGENT }, signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
    if (response.status === 404) return null;
    if (!response.ok) throw new DiscoveryHttpError(`telegram_http_${response.status}`, response.status, response.headers.get("retry-after"));
    const text = await response.text();
    if (text.length > 4_000_000) throw new Error("telegram_response_too_large");
    return text;
  }, signal);
}

/** Channel handles already mentioned by crawled catalogs and stored merchant contacts. */
export async function telegramSeedHandles(db: Database, limit = 200): Promise<string[]> {
  const { rows } = await boundedDiscoveryRead(db, readDb => readDb.execute<{ handle: string; mentions: number }>(sql`
    with latest as (
      select s.id as source_id, s.latest_complete_run_id as run_id
      from sources s where s.enabled and s.latest_complete_run_id is not null
    ), mentions as (
      select lower((regexp_matches(o.raw_description, '(?:t\\.me|telegram\\.me)/(?:s/)?([A-Za-z][A-Za-z0-9_]{3,31})', 'gi'))[1]) as handle, l.source_id
      from raw_offer_snapshots o join latest l on l.run_id = o.crawl_run_id
      union all
      select lower(regexp_replace(m.contact_public->>'telegram', '^.*?(?:t\\.me/|@)', '')) as handle, m.id
      from merchants m where m.contact_public ? 'telegram'
    )
    select handle, count(distinct source_id) as mentions from mentions
    where handle ~ '^[a-z][a-z0-9_]{3,31}$'
    group by handle order by mentions desc, handle limit ${limit}`));
  return rows.map((row) => row.handle);
}

export interface TelegramDiscoveryOptions {
  signal?: AbortSignal;
  minIntervalMs?: number;
  now?: Date;
  seedHandles?: readonly string[];
  maxChannels?: number;
  maxPagesPerChannel?: number;
  /** How many channels found inside seed channels may be read in the same run. */
  maxDiscoveredChannels?: number;
}

export interface TelegramDiscoveryReport {
  channelsRead: number;
  channelsMissing: number;
  messages: number;
  discoveredChannels: number;
}

export async function discoverTelegramChannels(db: Database, options: TelegramDiscoveryOptions = {}) {
  const report: TelegramDiscoveryReport = { channelsRead: 0, channelsMissing: 0, messages: 0, discoveredChannels: 0 };
  const run = await runScheduledDiscovery(db, { kind: "community", query: "t.me/s public channels", provider: TELEGRAM_CHANNEL_PROVIDER }, options, async (signal) => {
    const seeds = options.seedHandles ? [...options.seedHandles] : await telegramSeedHandles(db);
    const maxChannels = Math.max(1, options.maxChannels ?? 150);
    const maxPages = Math.max(1, options.maxPagesPerChannel ?? 3);
    const maxDiscovered = Math.max(0, options.maxDiscoveredChannels ?? 50);
    const queue = seeds.map((handle) => handle.toLowerCase()).filter((handle) => HANDLE.test(handle));
    const visited = new Set<string>();
    const leads = new Map<string, CandidateLead>();
    let discovered = 0;
    while (queue.length && visited.size < maxChannels) {
      signal.throwIfAborted();
      const handle = queue.shift()!;
      if (visited.has(handle)) continue;
      visited.add(handle);
      let before: number | null = null;
      for (let page = 0; page < maxPages; page += 1) {
        const html = await fetchChannelPage(handle, before, signal);
        if (html === null) { if (page === 0) report.channelsMissing += 1; break; }
        const parsed = parseTelegramChannelPage(html);
        if (page === 0) report.channelsRead += 1;
        report.messages += parsed.messages.length;
        for (const message of parsed.messages) {
          for (const link of [...message.links, ...message.text.match(/https?:\/\/[^\s"'<>()]+/g) ?? []]) {
            let url: URL;
            try { url = new URL(link); } catch { continue; }
            if (url.protocol !== "https:" && url.protocol !== "http:") continue;
            if (/^(?:t\.me|telegram\.me)$/i.test(url.hostname)) {
              for (const found of extractTelegramHandles(url.toString())) {
                if (!visited.has(found) && !queue.includes(found) && discovered < maxDiscovered) { queue.push(found); discovered += 1; }
              }
              continue;
            }
            if (isUtilityHost(url.hostname)) continue;
            url.hash = "";
            url.search = "";
            const key = url.toString();
            if (!mentionLooksLikeShop({ url: key, context: message.text })) continue;
            if (!leads.has(key)) leads.set(key, { url: key, provider: TELEGRAM_CHANNEL_PROVIDER, discoveryKind: "community", discoveryUrl: `https://t.me/s/${message.post}` });
          }
        }
        if (!parsed.before || parsed.messages.length === 0) break;
        before = parsed.before;
      }
    }
    report.discoveredChannels = discovered;
    return [...leads.values()];
  });
  if (run.status !== "success") return run;
  return { ...run, ...report };
}
