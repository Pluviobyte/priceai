import { z } from "zod";

export const collectorKindSchema = z.enum([
  "shop_api",
  "shop_api_16688",
  "kami",
  "dujiao",
  "public_json",
  "generic_html",
  "custom_html",
  "browser",
  "merchant_feed",
  "unsupported",
]);

export type CollectorKind = z.infer<typeof collectorKindSchema>;

export const sourceHealthSchema = z.enum([
  "healthy",
  "retrying",
  "failing",
  "paused",
  "removed",
  "blocked_egress",
]);

export type SourceHealth = z.infer<typeof sourceHealthSchema>;

export const sourceIdentitySchema = z.object({
  platformKind: z.string().min(1),
  platformMerchantId: z.string().min(1),
  canonicalEntryUrl: z.url(),
  merchantName: z.string().min(1).optional(),
  shopToken: z.string().min(1).optional(),
  // Public shop facts exposed by the platform itself. They feed merchant vetting,
  // never price comparison.
  merchantCreatedAt: z.iso.datetime().optional(),
  contact: z.record(z.string(), z.string()).optional(),
});

export type SourceIdentity = z.infer<typeof sourceIdentitySchema>;

export const sourceCandidateSchema = z.object({
  candidateUrl: z.url(),
  discoveryKind: z.enum([
    "submission",
    "manual",
    "grok_x",
    "search",
    "community",
    "aggregator",
    "directory",
    "platform",
  ]),
  discoveredAt: z.iso.datetime(),
  merchantNameHint: z.string().min(1).optional(),
  platformHint: z.string().min(1).optional(),
  discoveryUrl: z.url().optional(),
});

export type SourceCandidate = z.infer<typeof sourceCandidateSchema>;

