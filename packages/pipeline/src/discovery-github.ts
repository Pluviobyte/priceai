import { hostThrottle } from "@price-radar/collector-sdk";
import type { Database } from "@price-radar/database";
import { lastSuccessfulDiscoveryAt, recordDiscoveryRun, type CandidateLead } from "./candidates.js";
import { extractMentionedUrlsWithContext, isUtilityHost, mentionLooksLikeShop } from "./discovery-links.js";

/**
 * GitHub topic pages list repositories whose READMEs advertise AI account and
 * top-up shops. Both the topic page and raw READMEs are public, unauthenticated
 * and cheap to read once a week. Repository URLs themselves are never leads.
 */
export const GITHUB_TOPICS_PROVIDER = "github_topic_readmes";
export const DEFAULT_GITHUB_TOPICS = ["chatgpt-daichong", "chatgpt-plus-pay", "chatgpt-china", "chatgpt-plus", "claude-account", "ai-faka"];

const USER_AGENT = "AIPriceRadar/0.1 (+public-readme-discovery; shop URLs only)";

/** Repository slugs (owner/name) listed on a topic page. */
export function parseTopicRepositories(html: string): string[] {
  const repos = new Set<string>();
  for (const match of html.matchAll(/href="\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)"[^>]*(?:data-hydro-click|class="[^"]*Link[^"]*")/g)) {
    const slug = match[1] ?? "";
    if (/^(?:topics|features|sponsors|login|marketplace|orgs|site|about|explore|collections|trending|settings|search)\//.test(slug)) continue;
    if (slug.endsWith("/stargazers") || slug.endsWith("/forks")) continue;
    repos.add(slug);
  }
  return [...repos];
}

async function fetchText(url: string, signal: AbortSignal): Promise<string | null> {
  const target = new URL(url);
  return hostThrottle.run(target.hostname, async () => {
    const response = await fetch(target, { redirect: "follow", headers: { accept: "text/html,text/plain", "user-agent": USER_AGENT }, signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`github_http_${response.status}`);
    const text = await response.text();
    return text.length > 2_000_000 ? null : text;
  }, signal);
}

export interface GithubDiscoveryOptions {
  signal?: AbortSignal;
  minIntervalMs?: number;
  now?: Date;
  topics?: readonly string[];
  maxRepositoriesPerTopic?: number;
}

export async function discoverGithubTopicReadmes(db: Database, options: GithubDiscoveryOptions = {}) {
  const signal = options.signal ?? new AbortController().signal;
  const now = options.now ?? new Date();
  if (options.minIntervalMs) {
    const last = await lastSuccessfulDiscoveryAt(db, GITHUB_TOPICS_PROVIDER);
    if (last && now.getTime() - last.getTime() < options.minIntervalMs) return { status: "skipped" as const };
  }
  const topics = (options.topics ?? DEFAULT_GITHUB_TOPICS).map((topic) => topic.trim()).filter((topic) => /^[a-z0-9-]{2,50}$/i.test(topic));
  const maxRepos = Math.max(1, options.maxRepositoriesPerTopic ?? 30);
  let repositoriesRead = 0;
  const run = await recordDiscoveryRun(db, { kind: "community", query: `github topics: ${topics.join(",")}`, provider: GITHUB_TOPICS_PROVIDER }, async () => {
    const leads = new Map<string, CandidateLead>();
    const seenRepos = new Set<string>();
    for (const topic of topics) {
      signal.throwIfAborted();
      const page = await fetchText(`https://github.com/topics/${encodeURIComponent(topic)}`, signal).catch((error: unknown) => { if (signal.aborted) throw error; return null; });
      if (!page) continue;
      for (const repo of parseTopicRepositories(page).slice(0, maxRepos)) {
        if (seenRepos.has(repo)) continue;
        seenRepos.add(repo);
        const readme = await fetchText(`https://raw.githubusercontent.com/${repo}/HEAD/README.md`, signal).catch((error: unknown) => { if (signal.aborted) throw error; return null; });
        if (!readme) continue;
        repositoriesRead += 1;
        for (const mention of extractMentionedUrlsWithContext(readme, 120)) {
          const url = mention.url;
          const host = new URL(url).hostname;
          if (isUtilityHost(host) || /\.github\.io$/i.test(host) || !mentionLooksLikeShop(mention)) continue;
          if (!leads.has(url)) leads.set(url, { url, provider: GITHUB_TOPICS_PROVIDER, discoveryKind: "community", discoveryUrl: `https://github.com/${repo}` });
        }
      }
    }
    return [...leads.values()];
  });
  return { status: "success" as const, ...run, repositoriesRead };
}
