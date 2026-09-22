import { createAsyncCache, type AsyncCache } from "./async-cache";
import type { ChannelFilters } from "./channel-filters";
import type { ChannelCatalog } from "./channel-catalog";
import { buildChannelCatalog, loadChannelReadModel, type ChannelReadModel } from "./channel-read-model";
import { getPublicationPointer } from "./publication-state";

const globalForCatalogCache = globalThis as typeof globalThis & {
  priceRadarChannelCache?: ReturnType<typeof createAsyncCache<string, ChannelCatalog>>;
  priceRadarChannelReadModelCache?: ReturnType<typeof createAsyncCache<string, ChannelReadModel>>;
};
const channelCache = globalForCatalogCache.priceRadarChannelCache
  ?? createAsyncCache<string, ChannelCatalog>({ ttlMs: 30_000, maxEntries: 128, maxPending: 16 });
globalForCatalogCache.priceRadarChannelCache = channelCache;
const readModelCache = globalForCatalogCache.priceRadarChannelReadModelCache
  ?? createAsyncCache<string, ChannelReadModel>({ ttlMs: 5 * 60_000, maxEntries: 2, maxPending: 2 });
globalForCatalogCache.priceRadarChannelReadModelCache = readModelCache;

export function filterKey(filters: ChannelFilters) {
  const { layout: _layout, ...queryFilters } = filters;
  return JSON.stringify(queryFilters, Object.keys(queryFilters).sort());
}

export interface CatalogReadDependencies {
  getPointer(): Promise<{ generation_id: string | null } | null>;
  loadModel(generationId: string | null): Promise<ChannelReadModel>;
  modelCache: AsyncCache<string, ChannelReadModel>;
  resultCache: AsyncCache<string, ChannelCatalog>;
}

/** A publication-scoped, lazy read model. One query builds each requested view. */
export async function readCachedChannelCatalog(filters: ChannelFilters, dependencies: CatalogReadDependencies): Promise<ChannelCatalog> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const generationId = (await dependencies.getPointer())?.generation_id ?? "none";
    const model = await dependencies.modelCache.get(generationId, () => dependencies.loadModel(generationId === "none" ? null : generationId));
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
  });
}

export function getChannelCacheStats() { return channelCache.stats(); }
export function getChannelReadModelCacheStats() { return readModelCache.stats(); }
