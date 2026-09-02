import { z } from "zod";
import { rawOfferInputSchema } from "./offer.js";
import { collectorKindSchema, sourceIdentitySchema } from "./source.js";

export const crawlRunStatusSchema = z.enum([
  "queued",
  "running",
  "success",
  "partial",
  "failed",
  "cancelled",
]);

export type CrawlRunStatus = z.infer<typeof crawlRunStatusSchema>;

export const probeResultSchema = z.object({
  supported: z.boolean(),
  collectorKind: collectorKindSchema,
  confidence: z.number().min(0).max(1),
  identity: sourceIdentitySchema.optional(),
  evidence: z.array(z.string()),
  reason: z.string().optional(),
});

export type ProbeResult = z.infer<typeof probeResultSchema>;

export const catalogPageSchema = z.object({
  items: z.array(z.unknown()),
  cursor: z.string().optional(),
  nextCursor: z.string().optional(),
  expectedTotal: z.number().int().nonnegative().optional(),
  sourceUpdatedAt: z.iso.datetime().optional(),
  rawPayloadHash: z.string().min(16),
});

export type CatalogPage = z.infer<typeof catalogPageSchema>;

export const snapshotValidationSchema = z.object({
  status: crawlRunStatusSchema,
  completeSnapshot: z.boolean(),
  expectedTotal: z.number().int().nonnegative().optional(),
  fetchedTotal: z.number().int().nonnegative(),
  parsedTotal: z.number().int().nonnegative(),
  duplicateTotal: z.number().int().nonnegative(),
  issues: z.array(
    z.object({
      code: z.string().min(1),
      message: z.string().min(1),
      severity: z.enum(["warning", "error"]),
    }),
  ),
});

export type SnapshotValidation = z.infer<typeof snapshotValidationSchema>;

export const crawlResultSchema = z.object({
  status: crawlRunStatusSchema,
  completeSnapshot: z.boolean(),
  offers: z.array(rawOfferInputSchema),
  validation: snapshotValidationSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
});

export type CrawlResult = z.infer<typeof crawlResultSchema>;

