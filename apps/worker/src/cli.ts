import { runSubscriptionSweep } from "./subscription-runner.js";
import { InMemoryCollectorRegistry } from "@price-radar/collector-sdk";
import { BrowserCollector, fetchDocumentsWithBrowser } from "@price-radar/browser-collector";
import { createDatabase } from "@price-radar/database";
import { DujiaoCollector } from "@price-radar/dujiao-collector";
import { GenericHtmlCollector } from "@price-radar/generic-html-collector";
import { KamiCollector } from "@price-radar/kami-collector";
import { JsonFeedCollector } from "@price-radar/json-feed-collector";
import {
  assertSafePublicUrl,
  checkAggregatorCoverage,
  crawlSource,
  deliverNotificationOutbox,
  evaluatePriceAlerts,
  generateLlmExtractionCandidates,
  discoverSourcesWithBrave,
  discoverSourcesWithGrok,
  onboardSource,
  precheckSourceSubmission,
  publishLatestSnapshots,
  rollbackPublication,
  seedCanonicalProducts,
  storePublicGenerationSnapshot,
} from "@price-radar/pipeline";
import { LdxpShopApiCollector } from "@price-radar/shop-api-collector";
import { S3JsonObjectStore } from "@price-radar/object-storage";
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
  const registry = new InMemoryCollectorRegistry();
  registry.register(new LdxpShopApiCollector());
  registry.register(new KamiCollector());
  registry.register(new DujiaoCollector());
  registry.register(new GenericHtmlCollector());
  registry.register(new GenericHtmlCollector({ kind: "custom_html" }));
  registry.register(new JsonFeedCollector("public_json"));
  registry.register(new JsonFeedCollector("merchant_feed"));
  registry.register(
    new BrowserCollector({
      ...(config.browserExecutablePath
        ? { executablePath: config.browserExecutablePath }
        : {}),
    }),
  );

  try {
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
      if (result.status === "failed") process.exitCode = 1;
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
    throw new Error("usage: <probe|onboard|precheck-submission|crawl|publish|rollback|snapshot-generation|evaluate-alerts|deliver-notifications|refresh-subscriptions|refresh-official-api|refresh-transit|discover-grok|discover-search|coverage-check|llm-extract-candidates|bootstrap> [argument]");
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
