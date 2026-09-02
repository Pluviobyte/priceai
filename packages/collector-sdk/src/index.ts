import type {
  CatalogPage,
  ProbeResult,
  RawOfferInput,
  SnapshotValidation,
  SourceIdentity,
} from "@price-radar/schema";

export interface CollectorContext {
  sourceId: string;
  now: Date;
  signal: AbortSignal;
}

export interface CollectorAdapter {
  readonly kind: string;

  probe(sourceUrl: URL, signal: AbortSignal): Promise<ProbeResult>;

  resolveSourceIdentity(
    sourceUrl: URL,
    signal: AbortSignal,
  ): Promise<SourceIdentity>;

  fetchCatalog(
    source: SourceIdentity,
    context: CollectorContext,
    cursor?: string,
  ): Promise<CatalogPage>;

  validateSnapshot(pages: readonly CatalogPage[]): SnapshotValidation;

  normalizeItem(item: unknown, context: CollectorContext): RawOfferInput;
}

export interface CollectorRegistry {
  register(adapter: CollectorAdapter): void;
  get(kind: string): CollectorAdapter | undefined;
  probe(sourceUrl: URL, signal: AbortSignal): Promise<ProbeResult[]>;
}

export class InMemoryCollectorRegistry implements CollectorRegistry {
  readonly #adapters = new Map<string, CollectorAdapter>();

  register(adapter: CollectorAdapter): void {
    if (this.#adapters.has(adapter.kind)) {
      throw new Error(`collector_already_registered:${adapter.kind}`);
    }
    this.#adapters.set(adapter.kind, adapter);
  }

  get(kind: string): CollectorAdapter | undefined {
    return this.#adapters.get(kind);
  }

  async probe(sourceUrl: URL, signal: AbortSignal): Promise<ProbeResult[]> {
    const results = await Promise.all(
      [...this.#adapters.values()].map((adapter) =>
        adapter.probe(sourceUrl, signal),
      ),
    );

    return results.sort((left, right) => right.confidence - left.confidence);
  }
}

