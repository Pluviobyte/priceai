import type {
  AvailabilityState,
  FreshnessState,
  OfferMode,
  StockState,
} from "@price-radar/schema";

export interface OfferSignals {
  price: string;
  stockCount?: number;
  stockState: StockState;
  freshnessState: FreshnessState;
  classificationConfidence: number;
  offerMode: OfferMode;
  quarantineReason?: string;
}

export interface EligibilityDecision {
  availabilityState: AvailabilityState;
  participatesInDefaultLowestPrice: boolean;
  reasons: string[];
}

const defaultModes = new Set<OfferMode>([
  "recharge",
  "finished_account",
  "redeem_code",
  "team_seat",
]);

export function evaluateOfferEligibility(
  offer: OfferSignals,
): EligibilityDecision {
  const reasons: string[] = [];
  const numericPrice = Number(offer.price);

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    reasons.push("invalid_price");
  }
  if (offer.stockState === "conflict") reasons.push("stock_conflict");
  if (offer.stockState === "out_of_stock") reasons.push("out_of_stock");
  if (offer.stockCount === 0 && offer.stockState === "in_stock") {
    reasons.push("stock_count_conflict");
  }
  if (offer.freshnessState === "stale") reasons.push("stale");
  if (offer.classificationConfidence < 0.75) {
    reasons.push("low_classification_confidence");
  }
  if (offer.quarantineReason) reasons.push(offer.quarantineReason);

  const quarantined = reasons.some((reason) =>
    [
      "invalid_price",
      "stock_conflict",
      "stock_count_conflict",
      "low_classification_confidence",
    ].includes(reason),
  );
  const unavailable = reasons.includes("out_of_stock");
  const expired = reasons.includes("stale");

  const availabilityState: AvailabilityState = quarantined
    ? "quarantined"
    : unavailable
      ? "unavailable"
      : expired
        ? "expired"
        : "purchasable";

  return {
    availabilityState,
    participatesInDefaultLowestPrice:
      availabilityState === "purchasable" && defaultModes.has(offer.offerMode),
    reasons,
  };
}

export function compareEligibleOffers(left: OfferSignals, right: OfferSignals): number {
  const leftDecision = evaluateOfferEligibility(left);
  const rightDecision = evaluateOfferEligibility(right);

  if (
    leftDecision.participatesInDefaultLowestPrice !==
    rightDecision.participatesInDefaultLowestPrice
  ) {
    return leftDecision.participatesInDefaultLowestPrice ? -1 : 1;
  }

  return Number(left.price) - Number(right.price);
}

