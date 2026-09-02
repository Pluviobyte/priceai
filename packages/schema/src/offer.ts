import { z } from "zod";

export const stockStateSchema = z.enum([
  "in_stock",
  "low_stock",
  "out_of_stock",
  "unknown",
  "conflict",
]);

export type StockState = z.infer<typeof stockStateSchema>;

export const freshnessStateSchema = z.enum([
  "fresh",
  "aging",
  "stale",
  "unknown",
]);

export type FreshnessState = z.infer<typeof freshnessStateSchema>;

export const availabilityStateSchema = z.enum([
  "purchasable",
  "unavailable",
  "quarantined",
  "expired",
]);

export type AvailabilityState = z.infer<typeof availabilityStateSchema>;

export const offerModeSchema = z.enum([
  "recharge",
  "finished_account",
  "redeem_code",
  "team_seat",
  "shared_account",
  "web_mirror",
  "reverse_proxy",
  "api_credit",
  "short_term",
  "unknown",
]);

export type OfferMode = z.infer<typeof offerModeSchema>;

export const rawOfferInputSchema = z.object({
  sourceItemId: z.string().min(1),
  rawTitle: z.string().min(1),
  rawDescription: z.string().optional(),
  rawCategory: z.string().optional(),
  rawPriceText: z.string().min(1),
  price: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.string().length(3),
  rawStock: z.unknown().optional(),
  stockCount: z.number().int().nonnegative().optional(),
  stockState: stockStateSchema,
  productUrl: z.url(),
  sourceUpdatedAt: z.iso.datetime().optional(),
  capturedAt: z.iso.datetime(),
  rawPayloadHash: z.string().min(16),
});

export type RawOfferInput = z.infer<typeof rawOfferInputSchema>;

export const offerAttributesSchema = z.object({
  offerMode: offerModeSchema,
  durationDays: z.number().int().positive().optional(),
  region: z.string().optional(),
  accountOwnership: z.enum(["buyer", "merchant", "shared", "unknown"]),
  phoneBound: z.boolean().optional(),
  emailType: z.string().optional(),
  warrantyType: z.enum([
    "none",
    "first_login",
    "fixed_hours",
    "subscription_period",
    "unknown",
  ]),
  warrantyHours: z.number().int().nonnegative().optional(),
  autoDelivery: z.boolean().optional(),
  webAvailable: z.boolean().optional(),
  desktopAvailable: z.boolean().optional(),
  apiAvailable: z.boolean().optional(),
  shared: z.boolean().optional(),
  invoiceAvailable: z.boolean().optional(),
  riskFacts: z.array(z.string()),
});

export type OfferAttributes = z.infer<typeof offerAttributesSchema>;

export const classificationResultSchema = z.object({
  canonicalProductSlug: z.string().min(1).nullable(),
  attributes: offerAttributesSchema,
  confidence: z.number().min(0).max(1),
  matchedRules: z.array(z.string()),
  conflictingSignals: z.array(z.string()),
  classifierVersion: z.string().min(1),
  requiresReview: z.boolean(),
});

export type ClassificationResult = z.infer<typeof classificationResultSchema>;

