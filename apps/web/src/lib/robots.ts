// Crawlers that collect pages to train models. Cloudflare's managed list also named
// Baiduspider and PetalBot, the Baidu and Huawei search engines, which shut the site out
// of Chinese search; they are left out here and search engines stay welcome.
const TRAINING_CRAWLERS = [
  "Amazonbot", "Applebot-Extended", "Bytespider", "CCBot", "ClaudeBot", "Diffbot", "Google-Extended",
  "GPTBot", "omgili", "anthropic-ai", "Claude-Web", "cohere-ai", "MistralAI-Training", "meta-externalagent",
  "GoogleOther", "AwarioSmartBot", "AwarioRssBot", "Google-CloudVertexBot", "QualifiedBot", "Cotoyogi",
  "ICC-Crawler", "atlassian-bot", "FishBot", "BorderxBot", "NavuBot", "SemrushBot-SWA", "WARDBot",
  "magpie-crawler", "KimiBot", "CitibotSiteCrawler",
];

const DISALLOWED_PATHS = [
  "/admin/", "/api/admin/", "/api/transit/check",
  // Buy-link redirects: a crawler following them inflates click counts and leaves the site.
  "/out/",
  "/account", "/login",
  // Filtered and paged views repeat the canonical pages listed in the sitemap.
  "/*?*group=", "/*?*sort=", "/*?*view=", "/*?*q=",
];

export function robotsText(base: string): string {
  return [
    "User-agent: *",
    // Search and answers may quote the site; its content may not train models.
    "Content-Signal: search=yes,ai-train=no",
    "Allow: /",
    ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
    "",
    ...TRAINING_CRAWLERS.flatMap((agent) => [`User-agent: ${agent}`, "Disallow: /", ""]),
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");
}
