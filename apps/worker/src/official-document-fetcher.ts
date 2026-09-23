import { fetchDocumentsWithBrowser } from "@price-radar/browser-collector";

export function fetchOfficialDocuments(urls: readonly string[], executablePath?: string) {
  const xai = urls.length > 0 && urls.every(url => new URL(url).hostname === "x.ai");
  return fetchDocumentsWithBrowser(urls, {
    ...(executablePath ? { executablePath } : {}),
    ...(xai ? { includeHtml: true, navigationTimeoutMs: 15_000, challengeWaitMs: 0 } : {}),
  });
}
