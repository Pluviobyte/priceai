import { createAsyncCache, createStaleWhileRevalidate, type AsyncCache, type StaleWhileRevalidate } from "./async-cache";
import type { ChannelFilters } from "./channel-filters";
import type { ChannelCatalog } from "./channel-catalog";
import { buildChannelCatalog, loadChannelReadModel, type ChannelReadModel } from "./channel-read-model";
import { getPublicationPointer } from "./publication-state";

const globalForCatalogCache = globalThis as typeof globalThis & {
  priceRadarChannelCache?: ReturnType<typeof createAsyncCache<string, ChannelCatalog>>;
  priceRadarChannelReadModelCache?: ReturnType<typeof createAsyncCache<string, ChannelReadModel>>;
  priceRadarChannelReadModelStale?: StaleWhileRevalidate<string, ChannelReadModel>;
};
// Both caches are keyed by publication, so entries stay correct while their publication is current.
// Views are built in memory from the model; the model is the database read worth sharing.
const channelCache = globalForCatalogCache.priceRadarChannelCache
  ?? createAsyncCache<string, ChannelCatalog>({ ttlMs: 5 * 60_000, maxEntries: 128, maxPending: 16 });
globalForCatalogCache.priceRadarChannelCache = channelCache;
const readModelCache = globalForCatalogCache.priceRadarChannelReadModelCache
  ?? createAsyncCache<string, ChannelReadModel>({ ttlMs: 10 * 60_000, maxEntries: 2, maxPending: 2 });
globalForCatalogCache.priceRadarChannelReadModelCache = readModelCache;
const readModelStale = globalForCatalogCache.priceRadarChannelReadModelStale ?? createStaleWhileRevalidate(readModelCache, {
  maxStaleMs: 10 * 60_000,
  onBackgroundError: error => console.error("channel_read_model_refresh_failed", error),
});
globalForCatalogCache.priceRadarChannelReadModelStale = readModelStale;

export function filterKey(filters: ChannelFilters) {
  const { layout: _layout, ...queryFilters } = filters;
  return JSON.stringify(queryFilters, Object.keys(queryFilters).sort());
}

export interface CatalogReadDependencies {
  getPointer(): Promise<{ generation_id: string | null } | null>;
  loadModel(generationId: string | null): Promise<ChannelReadModel>;
  modelCache: AsyncCache<string, ChannelReadModel>;
  resultCache: AsyncCache<string, ChannelCatalog>;
  /** Wraps `modelCache`: answers a new publication with the previous model while it loads. */
  modelStaleFor?: StaleWhileRevalidate<string, ChannelReadModel>;
}

/** A publication-scoped, lazy read model. One query builds each requested view. */
export async function readCachedChannelCatalog(filters: ChannelFilters, dependencies: CatalogReadDependencies): Promise<ChannelCatalog> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const generationId = (await dependencies.getPointer())?.generation_id ?? "none";
    const load = () => dependencies.loadModel(generationId === "none" ? null : generationId);
    let model: ChannelReadModel;
    if (dependencies.modelStaleFor) {
      const result = await dependencies.modelStaleFor.get(generationId, load);
      if (result.stale) {
        // The previous publication's complete model, knowingly one publication behind.
        const previous = result.value;
        return dependencies.resultCache.get(`${previous.generationId ?? "none"}:${filterKey(filters)}`, async () => buildChannelCatalog(previous, filters));
      }
      model = result.value;
    } else {
      model = await dependencies.modelCache.get(generationId, load);
    }
    if ((model.generationId ?? "none") !== generationId) continue;
    const currentGenerationId = (await dependencies.getPointer())?.generation_id ?? "none";
    if (currentGenerationId !== generationId) continue;
    return dependencies.resultCache.get(`${generationId}:${filterKey(filters)}`, async () => buildChannelCatalog(model, filters));
  }
  throw new Error("publication_changed_during_catalog_read");
}

export function getCachedChannelCatalog(filters: ChannelFilters): Promise<ChannelCatalog> {
  return readCachedChannelCatalog(filters, {
    getPointer: getPublicationPointer,
    loadModel: generationId => loadChannelReadModel(generationId),
    modelCache: readModelCache,
    resultCache: channelCache,
    modelStaleFor: readModelStale,
  });
}

export function getChannelCacheStats() { return channelCache.stats(); }
export function getChannelReadModelCacheStats() { return { ...readModelCache.stats(), ...readModelStale.stats() }; }
