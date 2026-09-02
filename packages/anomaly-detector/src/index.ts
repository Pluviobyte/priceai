import type { StockState } from "@price-radar/schema";

export type AnomalySeverity = "info" | "warning" | "critical";

export interface OfferAnomaly {
  kind: string;
  severity: AnomalySeverity;
  observedValue?: unknown;
  baselineValue?: unknown;
  details: Record<string, unknown>;
}

export interface OfferAnomalyInput {
  price: string;
  stockCount?: number;
  stockState: StockState;
  classificationConfidence: number;
  canonicalProductSlug: string | null;
  previousPrice?: string;
  peerPrices?: readonly string[];
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const current = sorted[middle];
  if (current === undefined) return undefined;
  if (sorted.length % 2 === 1) return current;
  const previous = sorted[middle - 1];
  return previous === undefined ? current : (previous + current) / 2;
}

export function detectOfferAnomalies(input: OfferAnomalyInput): OfferAnomaly[] {
  const anomalies: OfferAnomaly[] = [];
  const price = Number(input.price);

  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
    anomalies.push({
      kind: "implausible_price",
      severity: "critical",
      observedValue: input.price,
      details: { rule: "price_must_be_positive_and_below_one_million" },
    });
  }
  if (
    (input.stockCount === 0 && input.stockState === "in_stock") ||
    ((input.stockCount ?? 0) > 0 && input.stockState === "out_of_stock") ||
    input.stockState === "conflict"
  ) {
    anomalies.push({
      kind: "stock_conflict",
      severity: "critical",
      observedValue: { stockCount: input.stockCount, stockState: input.stockState },
      details: { rule: "numeric_and_enum_stock_must_agree" },
    });
  }
  if (!input.canonicalProductSlug) {
    anomalies.push({
      kind: "unclassified_product",
      severity: "warning",
      observedValue: { confidence: input.classificationConfidence },
      details: { rule: "canonical_product_required_for_publication" },
    });
  } else if (input.classificationConfidence < 0.75) {
    anomalies.push({
      kind: "low_classification_confidence",
      severity: "warning",
      observedValue: input.classificationConfidence,
      details: { product: input.canonicalProductSlug, threshold: 0.75 },
    });
  }

  const previousPrice = input.previousPrice === undefined ? undefined : Number(input.previousPrice);
  if (
    Number.isFinite(price) &&
    price > 0 &&
    previousPrice !== undefined &&
    Number.isFinite(previousPrice) &&
    previousPrice > 0
  ) {
    const ratio = price / previousPrice;
    if (ratio >= 3 || ratio <= 1 / 3) {
      anomalies.push({
        kind: "large_price_change",
        severity: ratio >= 10 || ratio <= 0.1 ? "critical" : "warning",
        observedValue: price,
        baselineValue: previousPrice,
        details: { ratio },
      });
    }
  }

  const peers = (input.peerPrices ?? [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  const peerMedian = median(peers);
  if (Number.isFinite(price) && price > 0 && peerMedian !== undefined && peers.length >= 5) {
    const ratio = price / peerMedian;
    if (ratio >= 5 || ratio <= 0.2) {
      anomalies.push({
        kind: "peer_price_outlier",
        severity: ratio >= 10 || ratio <= 0.1 ? "critical" : "warning",
        observedValue: price,
        baselineValue: peerMedian,
        details: { ratio, peerCount: peers.length },
      });
    }
  }

  return anomalies;
}
