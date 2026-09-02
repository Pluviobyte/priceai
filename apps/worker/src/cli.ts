import { InMemoryCollectorRegistry } from "@price-radar/collector-sdk";
import { BrowserCollector } from "@price-radar/browser-collector";
import { createDatabase } from "@price-radar/database";
import { DujiaoCollector } from "@price-radar/dujiao-collector";
import { GenericHtmlCollector } from "@price-radar/generic-html-collector";
import { KamiCollector } from "@price-radar/kami-collector";
import {
  crawlSource,
  onboardSource,
  publishLatestSnapshots,
  seedCanonicalProducts,
} from "@price-radar/pipeline";
import { LdxpShopApiCollector } from "@price-radar/shop-api-collector";
import { readWorkerConfig } from "./config.js";

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  const config = readWorkerConfig();
  const database = createDatabase(config.databaseUrl);
  const registry = new InMemoryCollectorRegistry();
  registry.register(new LdxpShopApiCollector());
  registry.register(new KamiCollector());
  registry.register(new DujiaoCollector());
  registry.register(new GenericHtmlCollector());
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
      const result = await registry.probe(new URL(argument), new AbortController().signal);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "onboard") {
      if (!argument) throw new Error("usage: onboard <source-url>");
      const result = await onboardSource(database.db, registry, argument);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "crawl") {
      if (!argument) throw new Error("usage: crawl <source-id>");
      const result = await crawlSource(database.db, registry, argument);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "publish") {
      await seedCanonicalProducts(database.db);
      const result = await publishLatestSnapshots(database.db);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    if (command === "bootstrap") {
      if (!argument) throw new Error("usage: bootstrap <source-url>");
      const source = await onboardSource(database.db, registry, argument);
      const crawl = await crawlSource(database.db, registry, source.sourceId);
      await seedCanonicalProducts(database.db);
      const publication = await publishLatestSnapshots(database.db);
      process.stdout.write(`${JSON.stringify({ source, crawl, publication }, null, 2)}\n`);
      return;
    }
    throw new Error("usage: <probe|onboard|crawl|publish|bootstrap> [argument]");
  } finally {
    await database.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
