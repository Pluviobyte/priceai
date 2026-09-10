import { runSubscriptionSweep } from "./subscription-runner.js";
import { BrowserCollector, fetchDocumentsWithBrowser } from "@price-radar/browser-collector";
import { createDatabase } from "@price-radar/database";
import { sources } from "@price-radar/database/schema";
import { eq } from "drizzle-orm";
import {
  assertSafePublicUrl,
  checkAggregatorCoverage,
  crawlSource,
  measureCatalogGrowth,
  recoverGrowthCandidates,
  deliverNotificationOutbox,
  discoverGithubTopicReadmes,
  discoverTelegramChannels,
  enumerate16688SourceMarketplace,
  mineCrawledCatalogLinks,
  evaluatePriceAlerts,
  generateLlmExtractionCandidates,
  discoverSourcesWithBrave,
  discoverSourcesWithGrok,
  importSourceDirectories,
  onboardSource,
  precheckSourceSubmission,
  publishLatestSnapshots,
  refreshSourceQualityProfiles,
  repairShopApiEntryUrls,
  rollbackPublication,
  seedCanonicalProducts,
  storePublicGenerationSnapshot,
  vetNextCandidates,
} from "@price-radar/pipeline";
import { S3JsonObjectStore } from "@price-radar/object-storage";
import { runChannelCycle } from "./channel-cycle.js";
import { createCollectorRegistry } from "./registry.js";
import {
  refreshAllTransitProviders,
  refreshOfficialSubscriptionChannels,
  seedVerifiedOfficialApiPrices,
} from "@price-radar/price-channels";
import { readWorkerConfig } from "./config.js";

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  const config = readWorkerConfig();
  const database = createDatabase(config.databaseUrl);
  const rawObjectStore = new S3JsonObjectStore({
    endpoint: config.objectStorageEndpoint,
    region: config.objectStorageRegion,
    bucket: config.objectStorageBucket,
    accessKeyId: config.objectStorageAccessKey,
    secretAccessKey: config.objectStorageSecretKey,
  });
  const registry = createCollectorRegistry(database.db);
  registry.register(
    new BrowserCollector({
      ...(config.browserExecutablePath
        ? { executablePath: config.browserExecutablePath }
        : {}),
    }),
  );

  try {
    if (command === 'growth-report') { console.log(JSON.stringify(await measureCatalogGrowth(database.db),null,2)); return; }
    if (command === 'recover-growth') { console.log(JSON.stringify(await recoverGrowthCandidates(database.db, Number(argument) || 30))); return; }
    if (command === "refresh-channels") {
      await seedCanonicalProducts(database.db);
      const enabled = await database.db.select({id:sources.id}).from(sources).where(eq(sources.enabled,true));
      let failures = 0;
      for (const source of enabled) {
        try {
          const result = await crawlSource(database.db, registry, source.id);
          if (result.status !== "success") failures++;
          console.log(JSON.stringify({event:"channel_crawled",sourceId:source.id,result}));
        } catch (error) { failures++; console.error("channel_crawl_failed",source.id,error); }
      }
      const publication = await publishLatestSnapshots(database.db);
      console.log(JSON.stringify({event:"channels_published",sources:enabled.length,failures,publication}));
      if (failures) process.exitCode = 1;
      return;
    }
    if (command === "probe") {
      if (!argument) throw new Error("usage: probe <source-url>");
      const sourceUrl = await assertSafePublicUrl(argument);
      const result = await registry.probe(sourceUrl, new AbortController().signal);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "onboard") {
      if (!argument) throw new Error("usage: onboard <source-url>");
      const result = await onboardSource(database.db, registry, argument);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "precheck-submission") {
      if (!argument) throw new Error("usage: precheck-submission <submission-id>");
      const result = await precheckSourceSubmission(
        database.db,
        registry,
        argument,
        new AbortController().signal,
        rawObjectStore,
      );
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "crawl") {
      if (!argument) throw new Error("usage: crawl <source-id>");
      const result = await crawlSource(database.db, registry, argument, { rawObjectStore });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "publish") {
      await seedCanonicalProducts(database.db);
      const result = await publishLatestSnapshots(database.db);
      const publicSnapshot = await storePublicGenerationSnapshot(database.db, rawObjectStore, result.generationId);
      const alerts = await evaluatePriceAlerts(database.db, result.generationId);
      process.stdout.write(`${JSON.stringify({ ...result, publicSnapshot, alerts }, null, 2)}\n`);
      return;
    }
    if (command === "rollback") {
      if (!argument) throw new Error("usage: rollback <generation-id>");
      const result = await rollbackPublication(database.db, {
        targetGenerationId: argument,
        actorId: process.env.OPERATOR_ID ?? "cli-operator",
        reason: process.env.ROLLBACK_REASON ?? "manual CLI rollback",
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "snapshot-generation") {
      if (!argument) throw new Error("usage: snapshot-generation <generation-id>");
      const result = await storePublicGenerationSnapshot(database.db, rawObjectStore, argument);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "evaluate-alerts") {
      if (!argument) throw new Error("usage: evaluate-alerts <generation-id>");
      const result = await evaluatePriceAlerts(database.db, argument);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "deliver-notifications") {
      if (!config.notificationWebhookUrl || !config.notificationWebhookSecret) {
        throw new Error("notification_webhook_not_configured");
      }
      const result = await deliverNotificationOutbox(database.db, {
        url: config.notificationWebhookUrl,
        secret: config.notificationWebhookSecret,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "refresh-subscriptions") {
      // `refresh-subscriptions featured` limits Apple/Google/OpenAI to the featured regions.
      const result = await runSubscriptionSweep(config.databaseUrl, {
        force: true,
        scope: argument === "featured" ? "featured" : "full",
        fetchDocuments: (urls) => fetchDocumentsWithBrowser(urls, config.browserExecutablePath ? { executablePath: config.browserExecutablePath } : {}),
        onError: (source, error) => process.stderr.write(`official subscription source failed: ${source}: ${error instanceof Error ? error.message : String(error)}\n`),
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (["failed", "partial"].includes(result.status)) process.exitCode = 1;
      return;
    }
    if (command === "refresh-official-api") {
      const result = await seedVerifiedOfficialApiPrices(database.db);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "refresh-transit") {
      const result = await refreshAllTransitProviders(database.db);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "discover-grok") {
      if (!argument) throw new Error("usage: discover-grok <query>");
      const apiKey = process.env.XAI_API_KEY;
      if (!apiKey) throw new Error("XAI_API_KEY is required");
      const result = await discoverSourcesWithGrok(database.db, { apiKey, query: argument });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "discover-search") {
      if (!argument) throw new Error("usage: discover-search <query>");
      const apiKey = process.env.BRAVE_SEARCH_API_KEY;
      if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY is required");
      const result = await discoverSourcesWithBrave(database.db, { apiKey, query: argument });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "import-directories") {
      // Reads public shop directories; results are candidates only, never prices.
      const result = await importSourceDirectories(database.db);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "enumerate-16688") {
      const result = await enumerate16688SourceMarketplace(database.db, { allCategories: argument === "all" });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "discover-links") {
      // Shops mentioned inside our own crawled catalogs; no network access to third parties.
      const result = await mineCrawledCatalogLinks(database.db);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "discover-telegram") {
      const result = await discoverTelegramChannels(database.db, argument ? { seedHandles: argument.split(",") } : {});
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "discover-github") {
      const result = await discoverGithubTopicReadmes(database.db, argument ? { topics: argument.split(",") } : {});
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "vet-candidates") {
      const limit = argument ? Number(argument) : config.candidateVettingBatch;
      const result = await vetNextCandidates(database.db, registry, { limit, ...(config.objectStorageConfigured ? { rawObjectStore } : {}) });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "refresh-quality-profiles") {
      const result = await refreshSourceQualityProfiles(database.db, { limit: argument ? Number(argument) : 50, maxAgeMs: 0 });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "repair-entry-urls") {
      const result = await repairShopApiEntryUrls(database.db, registry, { limit: argument ? Number(argument) : 50 });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "channel-cycle") {
      // `channel-cycle force` re-reads the directories even when the last import is recent.
      const result = await runChannelCycle(registry, config, {
        forceDiscovery: argument === "force",
        ...(config.objectStorageConfigured ? { rawObjectStore } : {}),
        log: (event) => console.log(JSON.stringify(event)),
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (result.status === "skipped") process.exitCode = 2;
      return;
    }
    if (command === "coverage-check") {
      if (!argument) throw new Error("usage: coverage-check <public-feed-url>");
      const result = await checkAggregatorCoverage(database.db, argument);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "llm-extract-candidates") {
      const endpoint = process.env.LLM_EXTRACTION_ENDPOINT;
      const apiKey = process.env.LLM_EXTRACTION_API_KEY;
      const model = process.env.LLM_EXTRACTION_MODEL;
      if (!endpoint || !apiKey || !model) throw new Error("LLM_EXTRACTION_ENDPOINT, LLM_EXTRACTION_API_KEY and LLM_EXTRACTION_MODEL are required");
      const result = await generateLlmExtractionCandidates(database.db, { endpoint, apiKey, model, ...(argument ? { limit: Number(argument) } : {}) });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "bootstrap") {
      if (!argument) throw new Error("usage: bootstrap <source-url>");
      const source = await onboardSource(database.db, registry, argument);
      const crawl = await crawlSource(database.db, registry, source.sourceId, { rawObjectStore });
      await seedCanonicalProducts(database.db);
      const publication = await publishLatestSnapshots(database.db);
      const publicSnapshot = await storePublicGenerationSnapshot(database.db, rawObjectStore, publication.generationId);
      const alerts = await evaluatePriceAlerts(database.db, publication.generationId);
      process.stdout.write(`${JSON.stringify({ source, crawl, publication: { ...publication, publicSnapshot, alerts } }, null, 2)}\n`);
      return;
    }
    throw new Error("usage: <probe|onboard|precheck-submission|crawl|publish|rollback|snapshot-generation|evaluate-alerts|deliver-notifications|refresh-subscriptions|refresh-official-api|refresh-transit|import-directories|enumerate-16688|vet-candidates|refresh-quality-profiles|repair-entry-urls|channel-cycle|discover-grok|discover-search|discover-links|discover-telegram|discover-github|coverage-check|llm-extract-candidates|bootstrap> [argument]");
  } finally {
    await database.close();
    rawObjectStore.destroy();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
